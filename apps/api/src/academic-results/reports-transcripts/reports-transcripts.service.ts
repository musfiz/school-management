import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../common/decimal.util';
import { safeDiv } from '../common/decimal-math.util';

interface BreakdownEntry {
  componentId?: string;
  componentCode?: string;
  convertedMarks?: string;
  minPassMarks?: string;
  isAbsent?: boolean;
  isExempted?: boolean;
  isPassedComponent?: boolean;
  childExamTermId?: string;
  weightPct?: string;
  percentage?: string;
}

interface StudentResultRow {
  examTermId: string;
  studentId: string;
  syllabusSubjectId: string | null;
  combinedGroupCode: string | null;
  isMergedSummaryRow: boolean;
  assignedRole: string;
  creditHours: unknown;
  fullMarks: unknown;
  componentBreakdownJson: string | null;
  totalObtainedMarks: unknown;
  highestMarksInClass: unknown;
  percentageMarks: unknown;
  letterGrade: string;
  gradePoint: unknown;
  effectiveGpForGpa: unknown;
  weightedCreditPoints: unknown;
  isPassed: boolean;
  failReason: string | null;
}

interface SyllabusInfo {
  id: string;
  subjectCode: string;
  subjectName: string;
  fullMarks: string;
  creditHours: string;
  displayOrder: number;
  combinedGroupCode: string | null;
  combinedGroupName: string | null;
}

const PASSED_STATUSES = ['PASSED', 'PROMOTED_WITH_F'];

/**
 * Result Engine §PHASE 6 — reporting, marksheets, tabulation & analytics.
 *
 * Every number here is read back from the stored snapshot
 * (`student_subject_results` / `student_term_marksheets`) — nothing is
 * recalculated, which is what keeps the A3 tabulation fast (acceptance:
 * 500 students × all subjects < 500 ms) and the transcript identical to the
 * generated snapshot.
 */
@Injectable()
export class ReportsTranscriptsService {
  constructor(private readonly prisma: PrismaService) {}

  /* ================= 1. student transcript ================= */

  async getStudentTranscript(examTermId: string, studentId: string) {
    const term = await this.prisma.examTerms.findUnique({
      where: { id: examTermId },
      include: { gradingScales: { include: { gradingScaleRanges: { orderBy: { minPercentage: 'desc' } } } } },
    });
    if (!term) throw new NotFoundException(`Exam term #${examTermId} not found`);

    const student = await this.prisma.students.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);

    const [enrollment, marksheet, results, syllabus] = await Promise.all([
      this.prisma.studentEnrollments.findFirst({
        where: { studentId, academicSessionId: term.academicSessionId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentTermMarksheets.findFirst({ where: { examTermId, studentId } }),
      this.prisma.studentSubjectResults.findMany({ where: { examTermId, studentId } }),
      this.syllabusMap(term.academicSessionId, term.classOrDeptId),
    ]);

    if (!marksheet) {
      throw new NotFoundException(
        `No generated result for student #${studentId} on term #${examTermId} (run result generation first)`,
      );
    }

    const attendance = await this.prisma.studentAttendanceSummaries.findFirst({
      where: { examTermId, studentId },
    });

    const rows = results as unknown as StudentResultRow[];
    const bySyllabus = new Map(rows.filter((r) => r.syllabusSubjectId).map((r) => [r.syllabusSubjectId as string, r]));
    const mergedByGroup = new Map(
      rows.filter((r) => r.isMergedSummaryRow).map((r) => [r.combinedGroupCode as string, r]),
    );
    const papersByGroup = new Map<string, StudentResultRow[]>();
    for (const row of rows) {
      if (row.isMergedSummaryRow || !row.combinedGroupCode) continue;
      const list = papersByGroup.get(row.combinedGroupCode) ?? [];
      list.push(row);
      papersByGroup.set(row.combinedGroupCode, list);
    }

    const toRow = (row: StudentResultRow) => {
      const info = row.syllabusSubjectId ? syllabus.get(row.syllabusSubjectId) : undefined;
      return {
        syllabusSubjectId: row.syllabusSubjectId,
        combinedGroupCode: row.combinedGroupCode,
        isMergedSummaryRow: row.isMergedSummaryRow,
        assignedRole: row.assignedRole,
        subjectCode: info?.subjectCode ?? row.combinedGroupCode ?? null,
        subjectName: info?.subjectName ?? (row.combinedGroupCode ? this.groupName(syllabus, row.combinedGroupCode) : null),
        creditHours: String(row.creditHours),
        fullMarks: String(row.fullMarks),
        totalObtainedMarks: String(row.totalObtainedMarks),
        highestMarksInClass: String(row.highestMarksInClass),
        percentageMarks: String(row.percentageMarks),
        letterGrade: row.letterGrade,
        gradePoint: String(row.gradePoint),
        effectiveGpForGpa: String(row.effectiveGpForGpa),
        weightedCreditPoints: String(row.weightedCreditPoints),
        isPassed: row.isPassed,
        failReason: row.failReason,
        components: this.parseBreakdown(row.componentBreakdownJson).filter((entry) => entry.componentCode),
      };
    };

    const ordered: Array<Record<string, unknown>> = [];
    const emitted = new Set<string>();
    for (const info of [...syllabus.values()].sort((a, b) => a.displayOrder - b.displayOrder)) {
      if (emitted.has(info.id)) continue;
      const row = bySyllabus.get(info.id);
      if (!row) continue;
      if (row.combinedGroupCode) {
        const papers = (papersByGroup.get(row.combinedGroupCode) ?? []).sort(
          (a, b) => (syllabus.get(a.syllabusSubjectId as string)?.displayOrder ?? 0) - (syllabus.get(b.syllabusSubjectId as string)?.displayOrder ?? 0),
        );
        for (const paper of papers) emitted.add(paper.syllabusSubjectId as string);
        const merged = mergedByGroup.get(row.combinedGroupCode);
        ordered.push({
          kind: 'GROUP',
          groupCode: row.combinedGroupCode,
          groupName: this.groupName(syllabus, row.combinedGroupCode),
          // The merged summary row is the GPA authority for the group; a paper
          // row must never be used as the fallback (it carries its own totals).
          merged: merged ? toRow(merged) : null,
          papers: papers.map(toRow),
        });
      } else {
        emitted.add(info.id);
        ordered.push({ kind: 'STANDALONE', row: toRow(row) });
      }
    }

    return {
      term: {
        id: term.id,
        termName: term.termName,
        termType: term.termType,
        status: term.status,
        academicSessionId: term.academicSessionId,
        classOrDeptId: term.classOrDeptId,
        markRoundingMode: term.markRoundingMode,
      },
      student: {
        id: student.id,
        studentUniqueId: student.studentUniqueId,
        fullNameEn: student.fullNameEn,
        fullNameBn: student.fullNameBn,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        photoUrl: student.photoUrl,
      },
      enrollment: enrollment
        ? {
            classRollNo: enrollment.classRollNo,
            sectionOrBatchId: enrollment.sectionOrBatchId,
            shiftId: enrollment.shiftId,
            academicGroup: enrollment.academicGroup,
            boardRegistrationNo: enrollment.boardRegistrationNo,
          }
        : null,
      gradingScale: {
        id: term.gradingScales.id,
        name: term.gradingScales.name,
        scaleType: term.gradingScales.scaleType,
        maxPoint: String(term.gradingScales.maxPoint),
        minPassPercentage: String(term.gradingScales.minPassPercentage),
        fourthSubjectDeduction: String(term.gradingScales.fourthSubjectDeduction),
        ranges: term.gradingScales.gradingScaleRanges.map((range) => ({
          letterGrade: range.letterGrade,
          minPercentage: String(range.minPercentage),
          maxPercentage: String(range.maxPercentage),
          gradePoint: String(range.gradePoint),
          descriptiveRemark: range.descriptiveRemark,
        })),
      },
      subjects: ordered,
      marksheet: {
        totalCompulsorySubjects: marksheet.totalCompulsorySubjects,
        totalCreditsAttempted: String(marksheet.totalCreditsAttempted),
        totalCreditsEarned: String(marksheet.totalCreditsEarned),
        marksWithoutFourth: String(marksheet.marksWithoutFourth),
        marksWithFourth: String(marksheet.marksWithFourth),
        gpaWithoutFourth: String(marksheet.gpaWithoutFourth),
        fourthSubjectBonusGp: String(marksheet.fourthSubjectBonusGp),
        finalGpaOrCgpa: String(marksheet.finalGpaOrCgpa),
        finalLetterGrade: marksheet.finalLetterGrade,
        failedSubjectCount: marksheet.failedSubjectCount,
        attendancePercentage: String(marksheet.attendancePercentage),
        resultStatus: marksheet.resultStatus,
        meritPositionSection: marksheet.meritPositionSection,
        meritPositionShift: marksheet.meritPositionShift,
        meritPositionClass: marksheet.meritPositionClass,
        principalRemark: marksheet.principalRemark,
        generatedAt: marksheet.generatedAt,
      },
      attendance: attendance
        ? { percentage: String(attendance.attendancePercentage), source: attendance.source }
        : null,
      qr: this.buildQr(term.id, studentId, marksheet.finalGpaOrCgpa, marksheet.finalLetterGrade, marksheet.resultStatus),
    };
  }

  /* ================= 2. master tabulation broadsheet ================= */

  async getMasterTabulationBroadsheet(examTermId: string, sectionOrBatchId?: string, includeComponents = true) {
    const term = await this.prisma.examTerms.findUnique({ where: { id: examTermId } });
    if (!term) throw new NotFoundException(`Exam term #${examTermId} not found`);

    const sheets = await this.prisma.studentTermMarksheets.findMany({
      where: { examTermId, ...(sectionOrBatchId ? { sectionId: sectionOrBatchId } : {}) },
      orderBy: [{ sectionId: 'asc' }, { meritPositionSection: 'asc' }],
      take: 5000,
    });
    if (!sheets.length) {
      return {
        term: this.termSummary(term),
        columns: [],
        students: [],
        totalStudents: 0,
      };
    }

    const studentIds = sheets.map((sheet) => sheet.studentId);
    const [results, students, syllabus, enrollments] = await Promise.all([
      this.prisma.studentSubjectResults.findMany({
        where: { examTermId, studentId: { in: studentIds } },
      }),
      this.prisma.students.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, studentUniqueId: true, fullNameEn: true, fullNameBn: true },
      }),
      this.syllabusMap(term.academicSessionId, term.classOrDeptId),
      this.prisma.studentEnrollments.findMany({
        where: { studentId: { in: studentIds }, academicSessionId: term.academicSessionId },
        select: { studentId: true, classRollNo: true },
      }),
    ]);
    const rollByStudent = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment.classRollNo]));

    const rows = results as unknown as StudentResultRow[];
    const resultKey = (studentId: string, row: StudentResultRow) =>
      row.isMergedSummaryRow
        ? `${studentId}|m:${row.combinedGroupCode}`
        : `${studentId}|s:${row.syllabusSubjectId}`;
    const byKey = new Map(rows.map((row) => [resultKey(row.studentId, row), row]));

    /* -------- columns: papers (detail) then the merged group total -------- */
    const columns: Array<Record<string, unknown>> = [];
    const groupSeen = new Set<string>();
    const ordered = [...syllabus.values()].sort((a, b) => a.displayOrder - b.displayOrder);
    for (const info of ordered) {
      const row = rows.find((r) => r.syllabusSubjectId === info.id);
      if (row?.combinedGroupCode) {
        if (groupSeen.has(row.combinedGroupCode)) continue;
        groupSeen.add(row.combinedGroupCode);
        for (const paper of ordered.filter(
          (s) => rows.find((r) => r.syllabusSubjectId === s.id)?.combinedGroupCode === row.combinedGroupCode,
        )) {
          columns.push({
            key: `s:${paper.id}`,
            kind: 'PAPER',
            label: paper.subjectCode,
            subjectName: paper.subjectName,
            combinedGroupCode: row.combinedGroupCode,
            fullMarks: paper.fullMarks,
          });
        }
        const merged = rows.find(
          (r) => r.isMergedSummaryRow && r.combinedGroupCode === row.combinedGroupCode,
        );
        columns.push({
          key: `m:${row.combinedGroupCode}`,
          kind: 'MERGED',
          label: this.groupName(syllabus, row.combinedGroupCode) ?? row.combinedGroupCode,
          combinedGroupCode: row.combinedGroupCode,
          fullMarks: merged ? String(merged.fullMarks) : null,
        });
      } else if (row) {
        columns.push({
          key: `s:${info.id}`,
          kind: 'SUBJECT',
          label: info.subjectCode,
          subjectName: info.subjectName,
          combinedGroupCode: null,
          fullMarks: info.fullMarks,
        });
      }
    }

    const studentById = new Map(students.map((student) => [student.id, student]));
    const outRows = sheets.map((sheet) => {
      const marks: Record<string, unknown> = {};
      for (const column of columns) {
        const key = column.key as string;
        const row = byKey.get(`${sheet.studentId}|${key}`);
        if (!row) continue;
        const breakdown = this.parseBreakdown(row.componentBreakdownJson);
        marks[key] = {
          totalObtainedMarks: String(row.totalObtainedMarks),
          fullMarks: String(row.fullMarks),
          percentageMarks: String(row.percentageMarks),
          letterGrade: row.letterGrade,
          gradePoint: String(row.gradePoint),
          isPassed: row.isPassed,
          failReason: row.failReason,
          ...(includeComponents
            ? {
                components: breakdown.filter((entry) => entry.componentCode),
                weightedTerms: breakdown.filter((entry) => entry.childExamTermId),
              }
            : {}),
        };
      }
      const student = studentById.get(sheet.studentId);
      return {
        studentId: sheet.studentId,
        studentUniqueId: student?.studentUniqueId ?? null,
        fullNameEn: student?.fullNameEn ?? null,
        fullNameBn: student?.fullNameBn ?? null,
        classRollNo: rollByStudent.get(sheet.studentId) ?? null,
        sectionOrBatchId: sheet.sectionId,
        shiftId: sheet.shiftId,
        marks,
        summary: {
          totalCompulsorySubjects: sheet.totalCompulsorySubjects,
          totalCreditsAttempted: String(sheet.totalCreditsAttempted),
          totalCreditsEarned: String(sheet.totalCreditsEarned),
          marksWithoutFourth: String(sheet.marksWithoutFourth),
          marksWithFourth: String(sheet.marksWithFourth),
          gpaWithoutFourth: String(sheet.gpaWithoutFourth),
          fourthSubjectBonusGp: String(sheet.fourthSubjectBonusGp),
          finalGpaOrCgpa: String(sheet.finalGpaOrCgpa),
          finalLetterGrade: sheet.finalLetterGrade,
          failedSubjectCount: sheet.failedSubjectCount,
          attendancePercentage: String(sheet.attendancePercentage),
          resultStatus: sheet.resultStatus,
          meritPositionSection: sheet.meritPositionSection,
          meritPositionShift: sheet.meritPositionShift,
          meritPositionClass: sheet.meritPositionClass,
        },
      };
    });

    return {
      term: this.termSummary(term),
      columns,
      students: outRows,
      totalStudents: outRows.length,
    };
  }

  /* ================= 3. exam summary analytics ================= */

  async getExamSummaryAnalytics(examTermId: string) {
    const term = await this.prisma.examTerms.findUnique({
      where: { id: examTermId },
      include: { gradingScales: { include: { gradingScaleRanges: { orderBy: { minPercentage: 'desc' } } } } },
    });
    if (!term) throw new NotFoundException(`Exam term #${examTermId} not found`);

    const [sheets, results, syllabus, markGroups] = await Promise.all([
      this.prisma.studentTermMarksheets.findMany({ where: { examTermId } }),
      this.prisma.studentSubjectResults.findMany({ where: { examTermId } }),
      this.syllabusMap(term.academicSessionId, term.classOrDeptId),
      this.prisma.studentComponentMarks.groupBy({
        by: ['syllabusSubjectId', 'enteredBy'],
        where: { examTermId },
        _count: { _all: true },
      }),
    ]);

    const rows = results as unknown as StudentResultRow[];
    const appeared = sheets.length;
    const passed = sheets.filter((sheet) => PASSED_STATUSES.includes(sheet.resultStatus)).length;
    const statusCounts = new Map<string, number>();
    for (const sheet of sheets) {
      statusCounts.set(sheet.resultStatus, (statusCounts.get(sheet.resultStatus) ?? 0) + 1);
    }

    const letterOrder = term.gradingScales.gradingScaleRanges.map((range) => range.letterGrade);
    const gradeHistogram = letterOrder
      .map((letter) => ({
        letterGrade: letter,
        count: sheets.filter((sheet) => sheet.finalLetterGrade === letter).length,
      }))
      .filter((bucket) => bucket.count > 0 || letterOrder.length <= 10);

    const gpaValues = sheets.length ? sheets.map((sheet) => dec(sheet.finalGpaOrCgpa)) : [];

    /* -------- per subject (merged groups counted once) -------- */
    const subjectStats = new Map<string, { label: string; appeared: number; passed: number; failing: Map<string, number>; total: ReturnType<typeof dec> }>();
    for (const row of rows) {
      if (!row.isMergedSummaryRow && row.combinedGroupCode) continue; // papers are display-only
      const key = row.isMergedSummaryRow ? `GROUP:${row.combinedGroupCode}` : `SUBJECT:${row.syllabusSubjectId}`;
      const info = row.syllabusSubjectId ? syllabus.get(row.syllabusSubjectId) : undefined;
      const bucket =
        subjectStats.get(key) ??
        {
          label: info?.subjectCode ?? this.groupName(syllabus, row.combinedGroupCode ?? '') ?? key,
          appeared: 0,
          passed: 0,
          failing: new Map<string, number>(),
          total: dec(0),
        };
      bucket.appeared += 1;
      if (row.isPassed) bucket.passed += 1;
      else if (row.failReason) bucket.failing.set(row.failReason, (bucket.failing.get(row.failReason) ?? 0) + 1);
      bucket.total = bucket.total.plus(dec(String(row.percentageMarks)));
      subjectStats.set(key, bucket);
    }

    /* -------- per subject × teacher (entered_by) -------- */
    const userIds = [...new Set(markGroups.map((group) => group.enteredBy))];
    const users = userIds.length
      ? await this.prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));
    const teacherBreakdown = markGroups
      .map((group) => ({
        syllabusSubjectId: group.syllabusSubjectId,
        subjectCode: syllabus.get(group.syllabusSubjectId)?.subjectCode ?? null,
        enteredBy: group.enteredBy,
        teacherName: userById.get(group.enteredBy)?.name ?? null,
        teacherRole: userById.get(group.enteredBy)?.role ?? null,
        marksEntered: group._count._all,
      }))
      .sort((a, b) => b.marksEntered - a.marksEntered);

    return {
      term: this.termSummary(term),
      overall: {
        appeared,
        passed,
        failed: appeared - passed,
        passPercentage: dec(round2(safeDiv(passed, appeared).mul(100))).toFixed(2),
        averageGpa: gpaValues.length
          ? dec(round2(gpaValues.reduce((acc, value) => acc.plus(value), dec(0)).div(gpaValues.length))).toFixed(2)
          : '0.00',
        highestGpa: gpaValues.length ? gpaValues.reduce((a, b) => (b.gt(a) ? b : a)).toFixed(2) : '0.00',
        statusCounts: Object.fromEntries([...statusCounts.entries()]),
      },
      gradeHistogram,
      subjects: [...subjectStats.entries()].map(([key, bucket]) => ({
        key,
        label: bucket.label,
        appeared: bucket.appeared,
        passed: bucket.passed,
        failed: bucket.appeared - bucket.passed,
        passPercentage: dec(round2(safeDiv(bucket.passed, bucket.appeared).mul(100))).toFixed(2),
        averagePercentage: bucket.appeared ? dec(round2(bucket.total.div(bucket.appeared))).toFixed(2) : '0.00',
        failReasons: Object.fromEntries([...bucket.failing.entries()]),
      })),
      teachers: teacherBreakdown,
    };
  }

  /* ================= 4. merit list / fail list ================= */

  async getMeritList(
    examTermId: string,
    options: { scope?: 'section' | 'shift' | 'class'; sectionOrBatchId?: string; shiftId?: string; limit?: number } = {},
  ) {
    const term = await this.prisma.examTerms.findUnique({ where: { id: examTermId } });
    if (!term) throw new NotFoundException(`Exam term #${examTermId} not found`);

    const scope = options.scope ?? 'section';
    const orderColumn =
      scope === 'shift' ? 'meritPositionShift' : scope === 'class' ? 'meritPositionClass' : 'meritPositionSection';
    const sheets = await this.prisma.studentTermMarksheets.findMany({
      where: {
        examTermId,
        [orderColumn]: { not: null },
        ...(options.sectionOrBatchId ? { sectionId: options.sectionOrBatchId } : {}),
        ...(options.shiftId ? { shiftId: options.shiftId } : {}),
      },
      orderBy: { [orderColumn]: 'asc' },
      take: options.limit ?? 500,
    });

    const studentIds = sheets.map((sheet) => sheet.studentId);
    const [students, failing] = await Promise.all([
      this.prisma.students.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, studentUniqueId: true, fullNameEn: true, fullNameBn: true },
      }),
      this.prisma.studentSubjectResults.findMany({
        where: { examTermId, studentId: { in: studentIds }, isPassed: false },
      }),
    ]);
    const studentById = new Map(students.map((student) => [student.id, student]));
    const syllabus = await this.syllabusMap(term.academicSessionId, term.classOrDeptId);
    const failuresByStudent = new Map<string, Array<Record<string, unknown>>>();
    for (const row of failing as unknown as StudentResultRow[]) {
      if (!row.isMergedSummaryRow && row.combinedGroupCode) continue;
      const list = failuresByStudent.get(row.studentId) ?? [];
      list.push({
        label:
          (row.syllabusSubjectId ? syllabus.get(row.syllabusSubjectId)?.subjectCode : null) ??
          this.groupName(syllabus, row.combinedGroupCode ?? '') ??
          row.combinedGroupCode,
        failReason: row.failReason,
        totalObtainedMarks: String(row.totalObtainedMarks),
        fullMarks: String(row.fullMarks),
      });
      failuresByStudent.set(row.studentId, list);
    }

    return {
      term: this.termSummary(term),
      scope,
      total: sheets.length,
      entries: sheets.map((sheet) => ({
        position:
          scope === 'shift'
            ? sheet.meritPositionShift
            : scope === 'class'
              ? sheet.meritPositionClass
              : sheet.meritPositionSection,
        studentId: sheet.studentId,
        studentUniqueId: studentById.get(sheet.studentId)?.studentUniqueId ?? null,
        fullNameEn: studentById.get(sheet.studentId)?.fullNameEn ?? null,
        fullNameBn: studentById.get(sheet.studentId)?.fullNameBn ?? null,
        sectionOrBatchId: sheet.sectionId,
        shiftId: sheet.shiftId,
        finalGpaOrCgpa: String(sheet.finalGpaOrCgpa),
        gpaWithoutFourth: String(sheet.gpaWithoutFourth),
        finalLetterGrade: sheet.finalLetterGrade,
        marksWithFourth: String(sheet.marksWithFourth),
        marksWithoutFourth: String(sheet.marksWithoutFourth),
        failedSubjectCount: sheet.failedSubjectCount,
        attendancePercentage: String(sheet.attendancePercentage),
        resultStatus: sheet.resultStatus,
        failedSubjects: failuresByStudent.get(sheet.studentId) ?? [],
      })),
    };
  }

  async getFailList(examTermId: string, sectionOrBatchId?: string, limit = 500) {
    const term = await this.prisma.examTerms.findUnique({ where: { id: examTermId } });
    if (!term) throw new NotFoundException(`Exam term #${examTermId} not found`);

    const sheets = await this.prisma.studentTermMarksheets.findMany({
      where: {
        examTermId,
        ...(sectionOrBatchId ? { sectionId: sectionOrBatchId } : {}),
        NOT: { resultStatus: 'PASSED' },
      },
      orderBy: { failedSubjectCount: 'desc' },
      take: limit,
    });
    const studentIds = sheets.map((sheet) => sheet.studentId);
    const [students, failing, syllabus] = await Promise.all([
      this.prisma.students.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, studentUniqueId: true, fullNameEn: true, fullNameBn: true },
      }),
      this.prisma.studentSubjectResults.findMany({
        where: { examTermId, studentId: { in: studentIds }, isPassed: false },
      }),
      this.syllabusMap(term.academicSessionId, term.classOrDeptId),
    ]);
    const studentById = new Map(students.map((student) => [student.id, student]));
    const failuresByStudent = new Map<string, Array<Record<string, unknown>>>();
    for (const row of failing as unknown as StudentResultRow[]) {
      if (!row.isMergedSummaryRow && row.combinedGroupCode) continue;
      const list = failuresByStudent.get(row.studentId) ?? [];
      list.push({
        label:
          (row.syllabusSubjectId ? syllabus.get(row.syllabusSubjectId)?.subjectCode : null) ??
          this.groupName(syllabus, row.combinedGroupCode ?? '') ??
          row.combinedGroupCode,
        failReason: row.failReason,
        totalObtainedMarks: String(row.totalObtainedMarks),
        fullMarks: String(row.fullMarks),
      });
      failuresByStudent.set(row.studentId, list);
    }

    return {
      term: this.termSummary(term),
      total: sheets.length,
      entries: sheets.map((sheet) => ({
        studentId: sheet.studentId,
        studentUniqueId: studentById.get(sheet.studentId)?.studentUniqueId ?? null,
        fullNameEn: studentById.get(sheet.studentId)?.fullNameEn ?? null,
        fullNameBn: studentById.get(sheet.studentId)?.fullNameBn ?? null,
        sectionOrBatchId: sheet.sectionId,
        shiftId: sheet.shiftId,
        finalGpaOrCgpa: String(sheet.finalGpaOrCgpa),
        finalLetterGrade: sheet.finalLetterGrade,
        failedSubjectCount: sheet.failedSubjectCount,
        resultStatus: sheet.resultStatus,
        failedSubjects: failuresByStudent.get(sheet.studentId) ?? [],
      })),
    };
  }

  /* ================= helpers ================= */

  private termSummary(term: {
    id: string;
    termName: string;
    termType: string;
    status: string;
    academicSessionId: string;
    classOrDeptId: string;
    gradingScaleId: string;
  }) {
    return {
      id: term.id,
      termName: term.termName,
      termType: term.termType,
      status: term.status,
      academicSessionId: term.academicSessionId,
      classOrDeptId: term.classOrDeptId,
      gradingScaleId: term.gradingScaleId,
    };
  }

  private async syllabusMap(academicSessionId: string, classOrDeptId: string): Promise<Map<string, SyllabusInfo>> {
    const rows = await this.prisma.classSyllabusSubjects.findMany({
      where: { academicSessionId, classOrDeptId },
      include: { academicSubjects: true },
      orderBy: { displayOrder: 'asc' },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          subjectCode: row.academicSubjects?.subjectCode ?? '',
          subjectName: row.academicSubjects?.subjectName ?? '',
          fullMarks: String(row.fullMarks),
          creditHours: String(row.creditHours),
          displayOrder: row.displayOrder,
          combinedGroupCode: row.combinedGroupCode,
          combinedGroupName: row.combinedGroupName,
        },
      ]),
    );
  }

  private groupName(syllabus: Map<string, SyllabusInfo>, groupCode: string): string | null {
    if (!groupCode) return null;
    for (const info of syllabus.values()) {
      if (info.combinedGroupCode === groupCode) return info.combinedGroupName ?? groupCode;
    }
    return groupCode;
  }

  private parseBreakdown(json: string | null): BreakdownEntry[] {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? (parsed as BreakdownEntry[]) : [];
    } catch {
      return [];
    }
  }

  /** Printable-layer QR: a compact payload plus a checksum for verification. */
  private buildQr(
    examTermId: string,
    studentId: string,
    gpa: unknown,
    letterGrade: string,
    resultStatus: string,
  ) {
    const payload = ['SEM', 'v1', examTermId, studentId, String(gpa), letterGrade, resultStatus].join('|');
    return {
      version: 1,
      payload,
      checksum: createHash('sha256').update(payload).digest('hex').slice(0, 16).toUpperCase(),
      verifyPath: `/verify/result?term=${examTermId}&student=${studentId}`,
    };
  }
}
