import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../common/decimal.util';
import { clampNonNegative, compareDecimal, percentageOf, safeDiv, sum } from '../common/decimal-math.util';
import { resolveGpaRange, resolvePercentageRange, validateGradeRanges } from '../common/grade-lookup.util';
import { applyMarkRounding } from '../common/rounding.util';
import { stableRowId } from '../common/stable-id.util';
import {
  mapComponent,
  mapRanges,
  mapScale,
  mapStudent,
  mapSubject,
  toBreakdownJson,
  type EngineComponent,
  type EngineInput,
  type EngineMark,
  type EngineMarksheetRow,
  type EngineOutput,
  type EngineStudent,
  type EngineSubject,
  type EngineSubjectRow,
} from '../common/mapper.util';
import { MarksEntryService } from '../marks-entry/marks-entry.service';

export type ProgressReporter = (
  stage: string,
  progressPct: number,
  processedStudents?: number,
  totalStudents?: number,
) => void | Promise<void>;

const NON_CREDIT = 'NON_CREDIT';
const FOURTH_OPTIONAL = 'FOURTH_OPTIONAL';

/* ================= internal shapes ================= */

interface BreakdownEntry {
  componentId: string;
  componentCode: string;
  convertedMarks: string;
  minPassMarks: string;
  isAbsent: boolean;
  isExempted: boolean;
  isPassedComponent: boolean;
}

interface SubjectComputation {
  subject: EngineSubject;
  studentId: string;
  assignedRole: string;
  merged: boolean;
  groupCode: string | null;
  fullMarks: Decimal;
  total: Decimal;
  percentage: Decimal;
  letterGrade: string;
  gradePoint: Decimal;
  effective?: Decimal;
  isPassed: boolean;
  failReason: string | null;
  allAbsent: boolean;
  creditHours: Decimal;
  breakdown: BreakdownEntry[];
}

/**
 * §5 — the 8-stage calculation engine expressed as a **pure** function over an
 * `EngineInput`, so the acceptance cases can be unit-tested with no database.
 *
 * Stage 1 (syncing auto components) happens before this runs: the caller
 * persists `AUTO_FROM_SUB_EXAMS` / `AUTO_FROM_ATTENDANCE` marks first, so this
 * function always sees a complete component-mark matrix.
 */
export function buildSnapshots(input: EngineInput): EngineOutput {
  const warnings: string[] = [];
  const { scale, ranges, term } = input;
  const minPassPct = new Decimal(scale.minPassPercentage ?? 0);
  const maxPoint = new Decimal(scale.maxPoint ?? 0);
  const deduction = new Decimal(scale.fourthSubjectDeduction ?? 0);
  const isGpa5 = scale.scaleType === 'GPA_5';
  const isCgpa4 = scale.scaleType === 'CGPA_4';

  const componentsBySubject = groupBy(
    input.components,
    (c) => c.syllabusSubjectId,
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const enrollmentByStudent = groupBy(input.enrollments, (e) => e.studentId);
  const marksByKey = new Map<string, EngineMark>(
    input.marks.map((m) => [`${m.studentId}:${m.componentId}`, m]),
  );

  /* ---------- Stage 7 input: weighted child percentages ---------- */
  const cumulativeTotal = new Map<string, Decimal>();
  const cumulativeBreakdown = new Map<string, Array<Record<string, unknown>>>();
  if (term.termType === 'CUMULATIVE_ANNUAL' && input.cumulative) {
    const weightByChild = new Map(
      input.cumulative.weights.map((w) => [w.childExamTermId, new Decimal(w.weightPct)]),
    );
    for (const child of input.cumulative.childResults) {
      const weight = weightByChild.get(child.childExamTermId);
      if (!weight) continue;
      const key = `${child.studentId}:${child.syllabusSubjectId}`;
      cumulativeTotal.set(
        key,
        (cumulativeTotal.get(key) ?? new Decimal(0)).plus(new Decimal(child.percentage).mul(weight).div(100)),
      );
      const list = cumulativeBreakdown.get(key) ?? [];
      list.push({
        childExamTermId: child.childExamTermId,
        weightPct: weight.toFixed(2),
        percentage: child.percentage,
      });
      cumulativeBreakdown.set(key, list);
    }
  }

  /* ---------- Stages 2 & 3: per-student subject and merged-group rows ---------- */
  const rowsByStudent = new Map<string, SubjectComputation[]>();
  const authorityByStudent = new Map<string, SubjectComputation[]>();

  for (const student of input.students) {
    const enrollments = enrollmentByStudent.get(student.studentId) ?? [];
    const roleBySubject = new Map(enrollments.map((e) => [e.syllabusSubjectId, e.assignedRole]));
    const subjects = enrollments.length
      ? input.subjects.filter((s) => roleBySubject.has(s.id))
      : input.subjects;

    const computed: SubjectComputation[] = [];
    for (const subject of subjects) {
      const assignedRole = roleBySubject.get(subject.id) ?? subject.defaultSubjectRole;
      const cumulativeKey = `${student.studentId}:${subject.id}`;

      if (term.termType === 'CUMULATIVE_ANNUAL' && cumulativeTotal.has(cumulativeKey)) {
        computed.push(
          computeCumulativeSubject(
            subject,
            student,
            assignedRole,
            round2(cumulativeTotal.get(cumulativeKey)!),
            minPassPct,
            ranges,
            (cumulativeBreakdown.get(cumulativeKey) ?? []) as never,
          ),
        );
        continue;
      }

      computed.push(
        computeSubject(
          input.term.markRoundingMode,
          ranges,
          minPassPct,
          subject,
          student,
          assignedRole,
          componentsBySubject.get(subject.id) ?? [],
          marksByKey,
        ),
      );
    }

    // Stage 3 — merge 1st/2nd papers; the merged row is the GPA authority.
    const groups = new Map<string, SubjectComputation[]>();
    const authority: SubjectComputation[] = [];
    for (const item of computed) {
      if (item.groupCode) {
        const list = groups.get(item.groupCode) ?? [];
        list.push(item);
        groups.set(item.groupCode, list);
      } else {
        authority.push(item);
      }
    }
    const merged: SubjectComputation[] = [];
    for (const [groupCode, papers] of groups) {
      const row = mergeGroup(groupCode, papers, minPassPct, ranges);
      merged.push(row);
      authority.push(row);
    }

    rowsByStudent.set(student.studentId, [...computed, ...merged]);
    authorityByStudent.set(student.studentId, authority);
  }

  /* ---------- Stage 4: highest marks per subject and merged group ---------- */
  const subjectRows: EngineSubjectRow[] = [];
  for (const student of input.students) {
    for (const item of rowsByStudent.get(student.studentId) ?? []) {
      subjectRows.push({
        examTermId: term.id,
        studentId: item.studentId,
        syllabusSubjectId: item.merged ? null : item.subject.id,
        combinedGroupCode: item.groupCode,
        isMergedSummaryRow: item.merged,
        assignedRole: item.assignedRole,
        creditHours: item.creditHours.toFixed(2),
        fullMarks: item.fullMarks.toFixed(2),
        componentBreakdownJson: toBreakdownJson(item.breakdown as never),
        totalObtainedMarks: item.total.toFixed(2),
        highestMarksInClass: '0.00',
        percentageMarks: item.percentage.toFixed(2),
        letterGrade: item.letterGrade,
        gradePoint: item.gradePoint.toFixed(2),
        // CC-07 — the 4th subject's GPA contribution is reduced by the deduction.
        effectiveGpForGpa:
          item.assignedRole === FOURTH_OPTIONAL
            ? clampNonNegative(item.gradePoint.minus(deduction)).toFixed(2)
            : item.gradePoint.toFixed(2),
        weightedCreditPoints: item.gradePoint.mul(item.creditHours).toFixed(2),
        isPassed: item.isPassed,
        failReason: item.failReason,
      });
    }
  }

  const highestBySubject = new Map<string, Decimal>();
  const highestByGroup = new Map<string, Decimal>();
  for (const row of subjectRows) {
    const total = new Decimal(row.totalObtainedMarks);
    const map = row.isMergedSummaryRow ? highestByGroup : highestBySubject;
    const key = row.isMergedSummaryRow ? row.combinedGroupCode : row.syllabusSubjectId;
    if (!key) continue;
    if (!map.has(key) || total.gt(map.get(key)!)) map.set(key, total);
  }
  for (const row of subjectRows) {
    const key = row.isMergedSummaryRow ? row.combinedGroupCode : row.syllabusSubjectId;
    const map = row.isMergedSummaryRow ? highestByGroup : highestBySubject;
    const highest = key ? map.get(key) : undefined;
    if (highest) row.highestMarksInClass = highest.toFixed(2);
  }

  /* ---------- Stages 5-7: GPA/CGPA, 4th-subject bonus, marksheet ---------- */
  const marksheets: EngineMarksheetRow[] = [];
  for (const student of input.students) {
    const authority = authorityByStudent.get(student.studentId) ?? [];
    const base = authority.filter((a) => a.assignedRole !== NON_CREDIT);
    const compulsory = base.filter((a) => a.assignedRole !== FOURTH_OPTIONAL);
    const fourths = base.filter((a) => a.assignedRole === FOURTH_OPTIONAL);

    // Stage 5 — bonus GP + fail immunity (4th failures never count).
    for (const fourth of fourths) fourth.effective = clampNonNegative(fourth.gradePoint.minus(deduction));

    const marksWithoutFourth = sum(compulsory.map((c) => c.total.toFixed(2)));
    const marksWithFourth = marksWithoutFourth.plus(sum(fourths.map((f) => f.total.toFixed(2))));
    const failedCompulsory = compulsory.filter((c) => !c.isPassed).length;
    const bonus = sum(fourths.map((f) => f.effective ?? f.gradePoint));

    let totalCompulsorySubjects = 0;
    let totalCreditsAttempted = new Decimal(0);
    let totalCreditsEarned = new Decimal(0);
    let gpaWithoutFourth = new Decimal(0);
    let finalGpa = new Decimal(0);
    let finalLetter = 'F';
    let resultStatus = 'FAILED';
    let bonusForSheet = new Decimal(0);

    if (isGpa5) {
      const n = compulsory.length;
      totalCompulsorySubjects = n;
      const sumGp = sum(compulsory.map((c) => c.gradePoint.toFixed(2)));
      if (n === 0) {
        warnings.push(`student ${student.studentId}: no compulsory subject was evaluated`);
      } else if (failedCompulsory > 0) {
        finalLetter = 'F';
        resultStatus = 'FAILED';
      } else {
        gpaWithoutFourth = round2(sumGp.div(n));
        finalGpa = Decimal.min(maxPoint, round2(sumGp.plus(bonus).div(n)));
        finalLetter = resolveGpaRange(finalGpa, ranges)?.letterGrade ?? 'F';
        resultStatus = 'PASSED';
      }
      bonusForSheet = bonus;
    } else if (isCgpa4) {
      totalCompulsorySubjects = base.length;
      totalCreditsAttempted = sum(base.map((c) => c.creditHours.toFixed(2)));
      totalCreditsEarned = sum(base.filter((c) => c.isPassed).map((c) => c.creditHours.toFixed(2)));
      finalGpa = safeDiv(sum(base.map((c) => c.gradePoint.mul(c.creditHours).toFixed(2))), totalCreditsAttempted);
      gpaWithoutFourth = finalGpa;
      finalLetter = resolveGpaRange(finalGpa, ranges)?.letterGrade ?? 'F';
      const failed = base.filter((c) => !c.isPassed).length;
      const passedCourses = base.filter((c) => c.isPassed).length;
      if (failed === 0) resultStatus = 'PASSED';
      else if (
        term.minCoursesToPromote > 0 &&
        passedCourses >= term.minCoursesToPromote &&
        finalGpa.gte(dec(term.minCgpaToPromote))
      )
        resultStatus = 'PROMOTED_WITH_F';
      else resultStatus = 'FAILED';
    } else {
      // CC-12 — descriptive-only scales carry no GPA arithmetic.
      totalCompulsorySubjects = base.length;
      const overall = percentageOf(
        sum(base.map((c) => c.total.toFixed(2))),
        sum(base.map((c) => c.fullMarks.toFixed(2))),
      );
      finalLetter = resolvePercentageRange(overall, ranges)?.letterGrade ?? 'F';
      resultStatus = base.every((c) => c.isPassed) ? 'PASSED' : 'FAILED';
    }

    marksheets.push({
      examTermId: term.id,
      studentId: student.studentId,
      sectionId: student.sectionOrBatchId,
      shiftId: student.shiftId,
      totalCompulsorySubjects,
      totalCreditsAttempted: totalCreditsAttempted.toFixed(2),
      totalCreditsEarned: totalCreditsEarned.toFixed(2),
      marksWithoutFourth: marksWithoutFourth.toFixed(2),
      marksWithFourth: marksWithFourth.toFixed(2),
      gpaWithoutFourth: gpaWithoutFourth.toFixed(2),
      fourthSubjectBonusGp: bonusForSheet.toFixed(2),
      finalGpaOrCgpa: finalGpa.toFixed(2),
      finalLetterGrade: finalLetter,
      failedSubjectCount: failedCompulsory,
      attendancePercentage: new Decimal(input.attendance[student.studentId] ?? '100.00').toFixed(2),
      resultStatus,
      meritPositionSection: null,
      meritPositionClass: null,
      meritPositionShift: null,
      principalRemark: null,
    });
  }

  /* ---------- Stage 8: deterministic merit ranking ---------- */
  rankMarksheets(marksheets, input.students, 'section');
  rankMarksheets(marksheets, input.students, 'shift');
  rankMarksheets(marksheets, input.students, 'class');

  return { subjectRows, marksheets, warnings };
}

/* ================= stage 2 ================= */

function computeSubject(
  markRoundingMode: string,
  ranges: EngineInput['ranges'],
  minPassPct: Decimal,
  subject: EngineSubject,
  student: EngineStudent,
  assignedRole: string,
  components: EngineComponent[],
  marksByKey: Map<string, EngineMark>,
): SubjectComputation {
  let exemptedMax = new Decimal(0);
  let totalRaw = new Decimal(0);
  let allAbsent = components.length > 0;
  const failingCodes: string[] = [];
  const breakdown: BreakdownEntry[] = [];

  for (const component of components) {
    const mark = marksByKey.get(`${student.studentId}:${component.id}`);
    if (mark?.isExempted) {
      exemptedMax = exemptedMax.plus(dec(component.convertedMaxMarks));
      breakdown.push({
        componentId: component.id,
        componentCode: component.componentCode,
        convertedMarks: '0.00',
        minPassMarks: component.minPassMarks,
        isAbsent: false,
        isExempted: true,
        isPassedComponent: true,
      });
      continue;
    }
    // A missing row counts as absent; CC-19 pre-flight prevents it in practice.
    const isAbsent = mark ? mark.isAbsent : true;
    const converted = isAbsent ? new Decimal(0) : dec(mark?.convertedMarks);
    if (!isAbsent) allAbsent = false;
    const minPass = dec(component.minPassMarks);
    const passed = !isAbsent && (minPass.isZero() || converted.gte(minPass));
    if (!passed && !minPass.isZero()) failingCodes.push(component.componentCode);
    totalRaw = totalRaw.plus(converted);
    breakdown.push({
      componentId: component.id,
      componentCode: component.componentCode,
      convertedMarks: converted.toFixed(2),
      minPassMarks: component.minPassMarks,
      isAbsent,
      isExempted: false,
      isPassedComponent: passed,
    });
  }

  const effectiveFull = new Decimal(subject.fullMarks ?? 0).minus(exemptedMax);
  const total = applyMarkRounding(totalRaw, markRoundingMode);
  const percentage = percentageOf(total, effectiveFull);

  let isPassed: boolean;
  let failReason: string | null;
  if (components.length > 0 && allAbsent) {
    isPassed = false;
    failReason = 'ABSENT';
  } else {
    const pctOk = percentage.gte(minPassPct);
    const componentsOk = subject.passEvaluationMode === 'SEPARATE_COMPONENTS' ? failingCodes.length === 0 : true;
    isPassed = pctOk && componentsOk;
    failReason = isPassed ? null : failingCodes[0] ? `FAILED_${failingCodes[0]}` : 'BELOW_TOTAL';
  }
  const range = isPassed ? resolvePercentageRange(percentage, ranges) : null;

  return {
    subject,
    studentId: student.studentId,
    assignedRole,
    merged: false,
    groupCode: subject.combinedGroupCode,
    fullMarks: effectiveFull,
    total,
    percentage,
    letterGrade: isPassed ? range?.letterGrade ?? 'F' : 'F',
    gradePoint: isPassed ? new Decimal(range?.gradePoint ?? 0) : new Decimal(0),
    isPassed,
    failReason,
    allAbsent,
    creditHours: new Decimal(subject.creditHours ?? 0),
    breakdown,
  };
}

function computeCumulativeSubject(
  subject: EngineSubject,
  student: EngineStudent,
  assignedRole: string,
  percentage: Decimal,
  minPassPct: Decimal,
  ranges: EngineInput['ranges'],
  breakdown: BreakdownEntry[],
): SubjectComputation {
  const fullMarks = new Decimal(subject.fullMarks ?? 0);
  const passed = percentage.gte(minPassPct);
  const range = passed ? resolvePercentageRange(percentage, ranges) : null;
  return {
    subject,
    studentId: student.studentId,
    assignedRole,
    merged: false,
    groupCode: subject.combinedGroupCode,
    fullMarks,
    total: round2(fullMarks.mul(percentage).div(100)),
    percentage,
    letterGrade: passed ? range?.letterGrade ?? 'F' : 'F',
    gradePoint: passed ? new Decimal(range?.gradePoint ?? 0) : new Decimal(0),
    isPassed: passed,
    failReason: passed ? null : 'BELOW_TOTAL',
    allAbsent: false,
    creditHours: new Decimal(subject.creditHours ?? 0),
    breakdown,
  };
}

/* ================= stage 3 ================= */

function mergeGroup(
  groupCode: string,
  papers: SubjectComputation[],
  minPassPct: Decimal,
  ranges: EngineInput['ranges'],
): SubjectComputation {
  const fullMarks = sum(papers.map((p) => p.fullMarks.toFixed(2)));
  const total = sum(papers.map((p) => p.total.toFixed(2)));
  const percentage = percentageOf(total, fullMarks);
  const mode = papers[0]?.subject.passEvaluationMode ?? 'SEPARATE_COMPONENTS';
  const anyAllAbsent = papers.some((p) => p.allAbsent);

  let componentsOk = true;
  let failCode: string | null = null;
  let breakdown: BreakdownEntry[] = [];

  if (mode === 'COMBINED_PAPER_COMPONENTS') {
    const codes = new Set<string>();
    for (const paper of papers) for (const entry of paper.breakdown) codes.add(entry.componentCode);
    breakdown = [];
    for (const code of codes) {
      let converted = new Decimal(0);
      let minPass = new Decimal(0);
      let absent = false;
      let allExempted = true;
      for (const paper of papers) {
        const entry = paper.breakdown.find((b) => b.componentCode === code);
        if (!entry) continue;
        if (entry.isAbsent) absent = true;
        if (!entry.isExempted) {
          allExempted = false;
          converted = converted.plus(entry.convertedMarks);
          minPass = minPass.plus(entry.minPassMarks);
        }
      }
      if (absent || converted.lt(minPass)) {
        componentsOk = false;
        if (!failCode) failCode = code;
      }
      breakdown.push({
        componentId: '',
        componentCode: code,
        convertedMarks: converted.toFixed(2),
        minPassMarks: minPass.toFixed(2),
        isAbsent: absent,
        isExempted: allExempted,
        isPassedComponent: !absent && converted.gte(minPass),
      });
    }
  } else {
    componentsOk = papers.every((p) => p.isPassed);
    const failing = papers.find((p) => !p.isPassed);
    if (!componentsOk && failing?.failReason?.startsWith('FAILED_')) {
      failCode = failing.failReason.slice('FAILED_'.length);
    }
    breakdown = papers.flatMap((p) => p.breakdown);
  }

  const pctOk = percentage.gte(minPassPct);
  const isPassed = !anyAllAbsent && componentsOk && pctOk;
  const failReason = isPassed ? null : anyAllAbsent ? 'ABSENT' : failCode ? `FAILED_${failCode}` : 'BELOW_TOTAL';
  const range = isPassed ? resolvePercentageRange(percentage, ranges) : null;
  const assignedRole = papers.some((p) => p.assignedRole === FOURTH_OPTIONAL)
    ? FOURTH_OPTIONAL
    : papers[0]?.assignedRole ?? 'COMPULSORY';

  return {
    subject: {
      ...(papers[0].subject as EngineSubject),
      id: papers[0]?.subject.id ?? '',
      combinedGroupCode: groupCode,
      fullMarks: fullMarks.toFixed(2),
      creditHours: sum(papers.map((p) => p.creditHours.toFixed(2))).toFixed(2),
    },
    studentId: papers[0]?.studentId ?? '',
    assignedRole,
    merged: true,
    groupCode,
    fullMarks,
    total,
    percentage,
    letterGrade: isPassed ? range?.letterGrade ?? 'F' : 'F',
    gradePoint: isPassed ? new Decimal(range?.gradePoint ?? 0) : new Decimal(0),
    isPassed,
    failReason,
    allAbsent: anyAllAbsent,
    creditHours: sum(papers.map((p) => p.creditHours.toFixed(2))),
    breakdown,
  };
}

/* ================= stage 8 ================= */

type MeritScope = 'section' | 'shift' | 'class';

function rankMarksheets(marksheets: EngineMarksheetRow[], students: EngineStudent[], scope: MeritScope): void {
  const rollById = new Map(students.map((s) => [s.studentId, s.classRollNo]));
  const field =
    scope === 'section' ? 'meritPositionSection' : scope === 'shift' ? 'meritPositionShift' : 'meritPositionClass';
  const scopeKey = (sheet: EngineMarksheetRow) => {
    if (scope === 'section') return sheet.sectionId ?? 'NONE';
    if (scope === 'shift') return sheet.shiftId ?? 'NONE';
    return 'CLASS';
  };

  const groups = new Map<string, EngineMarksheetRow[]>();
  for (const sheet of marksheets) {
    const list = groups.get(scopeKey(sheet)) ?? [];
    list.push(sheet);
    groups.set(scopeKey(sheet), list);
  }

  for (const list of groups.values()) {
    list.sort(
      (a, b) =>
        a.failedSubjectCount - b.failedSubjectCount ||
        compareDecimal(b.finalGpaOrCgpa, a.finalGpaOrCgpa) ||
        compareDecimal(b.gpaWithoutFourth, a.gpaWithoutFourth) ||
        compareDecimal(b.marksWithFourth, a.marksWithFourth) ||
        compareDecimal(b.marksWithoutFourth, a.marksWithoutFourth) ||
        compareDecimal(b.attendancePercentage, a.attendancePercentage) ||
        (rollById.get(a.studentId) ?? 0) - (rollById.get(b.studentId) ?? 0),
    );
    list.forEach((sheet, index) => {
      (sheet as unknown as Record<string, number>)[field] = index + 1;
    });
  }
}

/* ================= helpers ================= */

function groupBy<T>(items: T[], key: (item: T) => string, sort?: (a: T, b: T) => number): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  if (sort) for (const list of map.values()) list.sort(sort);
  return map;
}

/* ================= I/O service ================= */

/**
 * Loads the engine input, runs the pure pipeline and persists the snapshot in
 * one transaction (CC-15). Stage 1 (auto-component sync) delegates to the
 * Phase-4 marks-entry service so there is one implementation of CC-06 / AD-4.
 */
@Injectable()
export class ResultCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marksEntry: MarksEntryService,
  ) {}

  async loadInput(termId: string, onProgress?: ProgressReporter): Promise<EngineInput> {
    const term = await this.prisma.examTerms.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException(`Exam term #${termId} not found`);

    await onProgress?.('LOAD_SCALE', 5);
    const scale = await this.prisma.gradingScales.findUnique({ where: { id: term.gradingScaleId } });
    if (!scale) throw new BadRequestException(`Grading scale #${term.gradingScaleId} not found`);
    const rangeRows = await this.prisma.gradingScaleRanges.findMany({
      where: { gradingScaleId: term.gradingScaleId },
      orderBy: { minPercentage: 'asc' },
    });
    const ranges = mapRanges(rangeRows);
    validateGradeRanges(ranges, `grading scale #${term.gradingScaleId}`);

    await onProgress?.('LOAD_SYLLABUS', 15);
    const subjectRows = await this.prisma.classSyllabusSubjects.findMany({
      where: { academicSessionId: term.academicSessionId, classOrDeptId: term.classOrDeptId },
      include: { academicSubjects: true },
      orderBy: { displayOrder: 'asc' },
    });
    const componentRows = await this.prisma.examSubjectComponents.findMany({
      where: { examTermId: termId },
      orderBy: { displayOrder: 'asc' },
    });
    const enrollments = await this.prisma.studentEnrollments.findMany({
      where: { academicSessionId: term.academicSessionId, classOrDeptId: term.classOrDeptId, isActive: true },
      orderBy: { classRollNo: 'asc' },
    });
    const studentIds = enrollments.map((e) => e.studentId);
    const subjectEnrollments = studentIds.length
      ? await this.prisma.studentSubjectEnrollments.findMany({
          where: { academicSessionId: term.academicSessionId, studentId: { in: studentIds } },
        })
      : [];

    await onProgress?.('LOAD_MARKS', 30);
    const markRows = await this.prisma.studentComponentMarks.findMany({ where: { examTermId: termId } });
    const attendanceRows = await this.prisma.studentAttendanceSummaries.findMany({ where: { examTermId: termId } });

    let cumulative: EngineInput['cumulative'];
    if (term.termType === 'CUMULATIVE_ANNUAL') {
      const weights = await this.prisma.examTermWeights.findMany({ where: { parentExamTermId: termId } });
      const childIds = weights.map((w) => w.childExamTermId);
      const childResults = childIds.length
        ? await this.prisma.studentSubjectResults.findMany({
            where: { examTermId: { in: childIds }, syllabusSubjectId: { not: null } },
          })
        : [];
      cumulative = {
        weights: weights.map((w) => ({ childExamTermId: w.childExamTermId, weightPct: String(w.weightPct) })),
        childResults: childResults.map((r) => ({
          childExamTermId: r.examTermId,
          studentId: r.studentId,
          syllabusSubjectId: r.syllabusSubjectId as string,
          percentage: String(r.percentageMarks),
        })),
      };
    }

    await onProgress?.('LOAD', 40);
    return {
      term: {
        id: term.id,
        termType: term.termType,
        markRoundingMode: term.markRoundingMode,
        minCoursesToPromote: term.minCoursesToPromote,
        minCgpaToPromote: String(term.minCgpaToPromote),
      },
      scale: mapScale(scale),
      ranges,
      subjects: subjectRows.map(mapSubject),
      components: componentRows.map(mapComponent),
      students: enrollments.map((e) =>
        mapStudent({
          studentId: e.studentId,
          classRollNo: e.classRollNo,
          sectionOrBatchId: e.sectionOrBatchId,
          shiftId: e.shiftId,
        }),
      ),
      enrollments: subjectEnrollments.map((e) => ({
        studentId: e.studentId,
        syllabusSubjectId: e.syllabusSubjectId,
        assignedRole: e.assignedRole,
      })),
      marks: markRows.map((m) => ({
        studentId: m.studentId,
        syllabusSubjectId: m.syllabusSubjectId,
        componentId: m.componentId,
        convertedMarks: String(m.convertedMarks),
        isAbsent: m.isAbsent,
        isExempted: m.isExempted,
      })),
      attendance: Object.fromEntries(attendanceRows.map((a) => [a.studentId, String(a.attendancePercentage)])),
      cumulative,
    };
  }

  async persist(termId: string, output: EngineOutput, onProgress?: ProgressReporter): Promise<void> {
    // CC-15 — stable ids make a re-run byte-identical (apart from `generated_at`).
    const subjectRows = output.subjectRows.map((row) => ({
      id: stableRowId(
        `${row.examTermId}:${row.studentId}:${
          row.isMergedSummaryRow ? `merged:${row.combinedGroupCode}` : `subject:${row.syllabusSubjectId}`
        }`,
      ),
      ...row,
    }));
    const marksheets = output.marksheets.map((row) => ({
      id: stableRowId(`${row.examTermId}:${row.studentId}:marksheet`),
      ...row,
    }));

    await this.prisma.$transaction(
      async (tx) => {
        await tx.studentSubjectResults.deleteMany({ where: { examTermId: termId } });
        await tx.studentTermMarksheets.deleteMany({ where: { examTermId: termId } });
        if (subjectRows.length) {
          await tx.studentSubjectResults.createMany({ data: subjectRows as never });
        }
        if (marksheets.length) {
          await tx.studentTermMarksheets.createMany({ data: marksheets as never });
        }
        // CC-15/CC-18 — generation moves the term to PUBLISHED.
        await tx.examTerms.update({ where: { id: termId }, data: { status: 'PUBLISHED' } });
      },
      { timeout: 120_000 },
    );
    await onProgress?.('PERSIST', 100);
  }

  /** Stage 1 + 2-8 + persist. Requires the term to be in `MARKS_ENTRY` (CC-18). */
  async generate(
    termId: string,
    actorId: string,
    onProgress?: ProgressReporter,
  ): Promise<EngineOutput & { autoSyncGaps: number }> {
    const term = await this.prisma.examTerms.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException(`Exam term #${termId} not found`);
    if (term.status !== 'MARKS_ENTRY') {
      throw new BadRequestException(
        `Generation is only allowed from MARKS_ENTRY (term is ${term.status})`,
      );
    }

    // Stage 1 — sync AUTO_FROM_SUB_EXAMS (CC-06) and AUTO_FROM_ATTENDANCE (AD-4).
    await onProgress?.('SYNC_AUTO_COMPONENTS', 2);
    const sync = await this.marksEntry.autoPopulateSubExamAndAttendanceMarks({ examTermId: termId }, actorId);

    const input = await this.loadInput(termId, onProgress);
    const output = buildSnapshots(input);
    await this.persist(termId, output, onProgress);
    return { ...output, autoSyncGaps: sync.gaps?.length ?? 0 };
  }
}
