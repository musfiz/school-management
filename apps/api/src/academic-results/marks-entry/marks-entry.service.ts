import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import type { ExamTerms } from '../../generated/prisma/client';
import { dec, round2 } from '../common/decimal.util';
import { aggregateCt, type CtFraction } from '../common/ct-aggregation.util';
import { AttendanceAdapterService } from '../common/attendance-adapter.service';
import { CsvOmrParserService } from './csv-omr-parser.service';
import type {
  AutoPopulateDto,
  BulkComponentMarksDto,
  ImportMarksDto,
  MarkRowDto,
  SetAttendanceDto,
} from './marks-entry.dto';

interface RosterRow {
  studentId: string;
  classRollNo: number;
  fullNameEn: string | null;
  studentUniqueId: string | null;
  sectionOrBatchId: string | null;
  boardRegistrationNo: string | null;
  assignedRole: string | null;
  subjectEnrolled: boolean;
}

/**
 * Result Engine §PHASE 4 — marks entry, attendance auto-pull & CSV/OMR import.
 *
 * CC-16: raw mark must be `0 <= raw <= max_raw_marks` (else 422 naming roll +
 * component); `converted = round(raw × conversion_weight_pct / 100, 2)` is
 * always computed server-side. CC-18: entry is blocked unless the term is
 * `SETUP | MARKS_ENTRY`.
 */
@Injectable()
export class MarksEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceAdapterService,
    private readonly parser: CsvOmrParserService,
  ) {}

  /* ================= entry sheet ================= */

  async getMarksEntrySheet(examTermId: string, syllabusSubjectId: string, sectionOrBatchId?: string) {
    const term = await this.getTerm(examTermId);
    const subject = await this.getTermSubject(term, syllabusSubjectId);
    const components = await this.prisma.examSubjectComponents.findMany({
      where: { examTermId, syllabusSubjectId },
      orderBy: { displayOrder: 'asc' },
    });
    const { rows: roster, rosterSource } = await this.resolveRoster(term, syllabusSubjectId, sectionOrBatchId);
    const attendance = await this.attendance.loadTermAttendance(examTermId);
    const marks = await this.prisma.studentComponentMarks.findMany({
      where: { examTermId, syllabusSubjectId, studentId: { in: roster.map((r) => r.studentId) } },
    });

    const byStudent = new Map<string, Map<string, (typeof marks)[number]>>();
    for (const mark of marks) {
      const bucket = byStudent.get(mark.studentId) ?? new Map();
      bucket.set(mark.componentId, mark);
      byStudent.set(mark.studentId, bucket);
    }

    const editable = term.status === 'SETUP' || term.status === 'MARKS_ENTRY';
    const rows = roster.map((student) => {
      const bucket = byStudent.get(student.studentId) ?? new Map();
      const cells: Record<string, unknown> = {};
      let convertedTotal = new Decimal(0);
      for (const component of components) {
        const mark = bucket.get(component.id);
        cells[component.id] = mark
          ? {
              rawMarksObtained: String(mark.rawMarksObtained),
              convertedMarks: String(mark.convertedMarks),
              isAbsent: mark.isAbsent,
              isExempted: mark.isExempted,
              isPassedComponent: mark.isPassedComponent,
            }
          : null;
        if (mark && !mark.isExempted) convertedTotal = convertedTotal.plus(mark.convertedMarks);
      }
      return {
        ...student,
        marks: cells,
        convertedTotal: convertedTotal.toFixed(2),
        attendance: attendance.get(student.studentId) ?? null,
        editable,
      };
    });

    return {
      term: {
        id: term.id,
        termName: term.termName,
        termType: term.termType,
        status: term.status,
        markRoundingMode: term.markRoundingMode,
      },
      subject: {
        syllabusSubjectId: subject.id,
        subjectCode: subject.academicSubjects?.subjectCode ?? null,
        subjectName: subject.academicSubjects?.subjectName ?? null,
        fullMarks: String(subject.fullMarks),
        passEvaluationMode: subject.passEvaluationMode,
        combinedGroupCode: subject.combinedGroupCode,
        defaultSubjectRole: subject.defaultSubjectRole,
      },
      rosterSource,
      editable,
      components: components.map((c) => ({
        id: c.id,
        componentCode: c.componentCode,
        componentName: c.componentName,
        sourceType: c.sourceType,
        sourceComponentCode: c.sourceComponentCode,
        maxRawMarks: String(c.maxRawMarks),
        conversionWeightPct: String(c.conversionWeightPct),
        convertedMaxMarks: String(c.convertedMaxMarks),
        minPassMarks: String(c.minPassMarks),
        displayOrder: c.displayOrder,
        editable: c.sourceType === 'MANUAL_ENTRY',
      })),
      rows,
    };
  }

  /* ================= bulk component marks ================= */

  async bulkUpsertComponentMarks(dto: BulkComponentMarksDto, actorId: string) {
    const term = await this.getTerm(dto.examTermId);
    this.assertEntryOpen(term);
    await this.getTermSubject(term, dto.syllabusSubjectId);

    const components = await this.prisma.examSubjectComponents.findMany({
      where: { examTermId: term.id, syllabusSubjectId: dto.syllabusSubjectId },
    });
    const componentById = new Map(components.map((c) => [c.id, c]));

    const studentIds = [...new Set(dto.rows.map((r) => r.studentId))];
    const enrollments = await this.prisma.studentEnrollments.findMany({
      where: { academicSessionId: term.academicSessionId, studentId: { in: studentIds } },
      select: { studentId: true, classRollNo: true },
    });
    const rollById = new Map(enrollments.map((e) => [e.studentId, e.classRollNo]));

    const data: Array<{
      examTermId: string;
      studentId: string;
      syllabusSubjectId: string;
      componentId: string;
      rawMarksObtained: string;
      convertedMarks: string;
      isAbsent: boolean;
      isExempted: boolean;
      isPassedComponent: boolean;
      enteredBy: string;
    }> = [];
    const seen = new Set<string>();

    for (const row of dto.rows) {
      const component = componentById.get(row.componentId);
      if (!component) {
        throw new BadRequestException(
          `component ${row.componentId} does not belong to this term/subject`,
        );
      }
      if (component.sourceType !== 'MANUAL_ENTRY') {
        throw new BadRequestException(
          `component ${component.componentCode} is ${component.sourceType} — it is populated automatically`,
        );
      }
      const key = `${row.studentId}:${row.componentId}`;
      if (seen.has(key)) {
        throw new BadRequestException(`duplicate row for student ${row.studentId} / ${component.componentCode}`);
      }
      seen.add(key);

      data.push(this.buildMarkRow(term, dto.syllabusSubjectId, row, component, rollById.get(row.studentId), actorId));
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentComponentMarks.deleteMany({
        where: {
          examTermId: term.id,
          syllabusSubjectId: dto.syllabusSubjectId,
          studentId: { in: studentIds },
          componentId: { in: [...new Set(dto.rows.map((r) => r.componentId))] },
        },
      });
      await tx.studentComponentMarks.createMany({ data });
    });

    return { saved: data.length, students: studentIds.length, components: new Set(dto.rows.map((r) => r.componentId)).size };
  }

  /* ================= auto-populate (CC-06 + AD-4) ================= */

  async autoPopulateSubExamAndAttendanceMarks(dto: AutoPopulateDto, actorId: string) {
    const term = await this.getTerm(dto.examTermId);
    this.assertEntryOpen(term);

    const autoComponents = await this.prisma.examSubjectComponents.findMany({
      where: {
        examTermId: term.id,
        sourceType: { in: ['AUTO_FROM_SUB_EXAMS', 'AUTO_FROM_ATTENDANCE'] },
        ...(dto.syllabusSubjectId ? { syllabusSubjectId: dto.syllabusSubjectId } : {}),
      },
      orderBy: { displayOrder: 'asc' },
    });
    if (!autoComponents.length) {
      return { updated: 0, components: 0, students: 0, gaps: [], message: 'No auto-populated components on this term' };
    }

    const attendance = await this.attendance.loadTermAttendance(term.id);
    const slabs = await this.attendance.loadSlabs();
    const children = await this.prisma.examTerms.findMany({
      where: { parentTerminalExamId: term.id },
      orderBy: { sequenceNo: 'asc' },
    });

    const gaps: Array<Record<string, unknown>> = [];
    const data: Array<Record<string, unknown>> = [];
    const subjectIds = [...new Set(autoComponents.map((c) => c.syllabusSubjectId))];
    const studentIds = new Set<string>();

    for (const subjectId of subjectIds) {
      const subject = await this.prisma.classSyllabusSubjects.findUnique({ where: { id: subjectId } });
      if (!subject) continue;
      const { rows: roster } = await this.resolveRoster(term, subjectId);

      for (const component of autoComponents.filter((c) => c.syllabusSubjectId === subjectId)) {
        if (component.sourceType === 'AUTO_FROM_ATTENDANCE') {
          for (const student of roster) {
            const record = attendance.get(student.studentId);
            if (!record) {
              gaps.push({ code: 'NO_ATTENDANCE_SUMMARY', syllabusSubjectId: subjectId, componentCode: component.componentCode, classRollNo: student.classRollNo });
              continue;
            }
            const awarded = this.attendance.resolveSlabAwardedMarks(record.percentage, slabs);
            if (awarded == null) {
              gaps.push({ code: 'NO_MATCHING_ATTENDANCE_SLAB', syllabusSubjectId: subjectId, componentCode: component.componentCode, classRollNo: student.classRollNo, percentage: record.percentage });
              continue;
            }
            const converted = round2(dec(awarded).mul(component.conversionWeightPct).div(100));
            data.push({
              examTermId: term.id, studentId: student.studentId, syllabusSubjectId: subjectId, componentId: component.id,
              rawMarksObtained: dec(awarded).toFixed(2), convertedMarks: converted.toFixed(2),
              isAbsent: false, isExempted: false, isPassedComponent: converted.gte(component.minPassMarks), enteredBy: actorId,
            });
            studentIds.add(student.studentId);
          }
          continue;
        }

        // AUTO_FROM_SUB_EXAMS — CC-06
        const childComponents = new Map<string, { id: string; convertedMaxMarks: Decimal }>();
        for (const child of children) {
          const childComponent = await this.prisma.examSubjectComponents.findFirst({
            where: { examTermId: child.id, syllabusSubjectId: subjectId, componentCode: component.sourceComponentCode ?? '' },
            select: { id: true, convertedMaxMarks: true },
          });
          if (childComponent) {
            childComponents.set(child.id, { id: childComponent.id, convertedMaxMarks: dec(childComponent.convertedMaxMarks) });
          }
        }
        if (!childComponents.size) {
          gaps.push({ code: 'NO_CHILD_SUB_EXAM_COMPONENT', syllabusSubjectId: subjectId, componentCode: component.componentCode, sourceComponentCode: component.sourceComponentCode });
          continue;
        }

        const childMarks = await this.prisma.studentComponentMarks.findMany({
          where: { componentId: { in: [...childComponents.values()].map((c) => c.id) } },
        });
        const markByChildStudent = new Map<string, (typeof childMarks)[number]>();
        for (const mark of childMarks) markByChildStudent.set(`${mark.examTermId}:${mark.studentId}`, mark);

        for (const student of roster) {
          const fractions: CtFraction[] = [];
          let missingMarks = 0;
          for (const child of children) {
            const childComponent = childComponents.get(child.id);
            if (!childComponent) continue;
            const mark = markByChildStudent.get(`${child.id}:${student.studentId}`);
            if (!mark) missingMarks += 1;
            const converted = !mark || mark.isAbsent ? new Decimal(0) : new Decimal(mark.convertedMarks);
            const f = childComponent.convertedMaxMarks.isZero() ? new Decimal(0) : converted.div(childComponent.convertedMaxMarks);
            fractions.push({ f, weight: dec(child.annualWeightPct) });
          }
          const aggregated = aggregateCt(term.ctAggregationMode, term.ctBestCount, fractions);
          if (aggregated == null) {
            gaps.push({ code: 'CT_K_ZERO', syllabusSubjectId: subjectId, componentCode: component.componentCode, classRollNo: student.classRollNo });
            continue;
          }
          if (missingMarks) {
            gaps.push({ code: 'MISSING_CHILD_MARKS', syllabusSubjectId: subjectId, componentCode: component.componentCode, classRollNo: student.classRollNo, missingMarks });
          }
          const converted = round2(aggregated.mul(component.convertedMaxMarks));
          const weight = dec(component.conversionWeightPct);
          const raw = weight.isZero() ? converted : round2(converted.mul(100).div(weight));
          data.push({
            examTermId: term.id, studentId: student.studentId, syllabusSubjectId: subjectId, componentId: component.id,
            rawMarksObtained: Decimal.min(raw, component.maxRawMarks).toFixed(2), convertedMarks: converted.toFixed(2),
            isAbsent: false, isExempted: false, isPassedComponent: converted.gte(component.minPassMarks), enteredBy: actorId,
          });
          studentIds.add(student.studentId);
        }
      }
    }

    const componentIds = autoComponents.map((c) => c.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.studentComponentMarks.deleteMany({ where: { componentId: { in: componentIds } } });
      if (data.length) {
        await tx.studentComponentMarks.createMany({ data: data as never });
      }
    });

    return { updated: data.length, components: componentIds.length, students: studentIds.size, gaps };
  }

  /* ================= CSV / OMR import ================= */

  async importMarks(dto: ImportMarksDto, csvText: string, actorId: string) {
    const term = await this.getTerm(dto.examTermId);
    this.assertEntryOpen(term);
    await this.getTermSubject(term, dto.syllabusSubjectId);

    const components = await this.prisma.examSubjectComponents.findMany({
      where: { examTermId: term.id, syllabusSubjectId: dto.syllabusSubjectId },
    });
    const componentByCode = new Map(components.map((c) => [c.componentCode.toUpperCase(), c]));

    const parsed = this.parser.parse(csvText);
    const rollKey = parsed.headers.find((h) => ['ROLL', 'CLASS_ROLL_NO', 'ROLL_NO', 'CLASSROLLNO'].includes(h.toUpperCase()));
    if (!rollKey) throw new BadRequestException('The import file must include a "roll" column');
    const componentHeaders = parsed.headers.filter((h) => componentByCode.has(h.toUpperCase()));
    if (!componentHeaders.length) {
      throw new BadRequestException('No column matched a component of this subject');
    }

    const { rows: roster } = await this.resolveRoster(term, dto.syllabusSubjectId, dto.sectionOrBatchId);
    const rosterByRoll = new Map(roster.map((r) => [r.classRollNo, r]));

    const plan: MarkRowDto[] = [];
    const diff: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];

    for (const row of parsed.rows) {
      const rollRaw = row.cells[rollKey] ?? '';
      const roll = Number(rollRaw);
      const student = Number.isInteger(roll) ? rosterByRoll.get(roll) : undefined;
      if (!student) {
        errors.push({ line: row.lineNumber, code: 'UNKNOWN_ROLL', message: `Roll "${rollRaw}" is not in this class/section` });
        continue;
      }
      for (const header of componentHeaders) {
        const component = componentByCode.get(header.toUpperCase())!;
        const cell = this.parser.classifyCell(row.cells[header] ?? '');
        if (cell.kind === 'EMPTY') continue;
        if (component.sourceType !== 'MANUAL_ENTRY') {
          errors.push({ line: row.lineNumber, classRollNo: roll, componentCode: component.componentCode, code: 'NOT_MANUAL', message: 'component is auto-populated' });
          continue;
        }
        let rawMarksObtained = '0';
        let isAbsent = false;
        let isExempted = false;
        if (cell.kind === 'ABSENT') {
          isAbsent = true;
        } else if (cell.kind === 'EXEMPT') {
          isExempted = true;
        } else if (cell.kind === 'NUMBER') {
          const value = new Decimal(cell.value);
          if (value.isNegative() || value.gt(component.maxRawMarks)) {
            errors.push({ line: row.lineNumber, classRollNo: roll, componentCode: component.componentCode, code: 'OVER_MAX', message: `${cell.value} exceeds max_raw_marks ${String(component.maxRawMarks)}` });
            continue;
          }
          rawMarksObtained = value.toFixed(2);
        } else {
          errors.push({ line: row.lineNumber, classRollNo: roll, componentCode: component.componentCode, code: 'INVALID_CELL', message: `Unrecognised value "${cell.value}"` });
          continue;
        }
        plan.push({ studentId: student.studentId, componentId: component.id, rawMarksObtained, isAbsent, isExempted });
        diff.push({ line: row.lineNumber, classRollNo: roll, componentCode: component.componentCode, rawMarksObtained, isAbsent, isExempted });
      }
    }

    if (!dto.commit) {
      return {
        dryRun: true,
        committed: false,
        rows: parsed.rows.length,
        plan: plan.length,
        errors,
        diff,
        canCommit: errors.length === 0 && plan.length > 0,
      };
    }

    if (errors.length) {
      throw new UnprocessableEntityException({
        message: `Import rejected: ${errors.length} problem row(s) — nothing was written`,
        errors,
      });
    }
    if (!plan.length) throw new BadRequestException('The import contained no marks to save');

    const result = await this.bulkUpsertComponentMarks(
      { examTermId: term.id, syllabusSubjectId: dto.syllabusSubjectId, rows: plan },
      actorId,
    );
    return { dryRun: false, committed: true, saved: result.saved, rows: parsed.rows.length };
  }

  /* ================= attendance ================= */

  async listAttendance(examTermId: string) {
    await this.getTerm(examTermId);
    return this.attendance.listTermAttendance(examTermId);
  }

  setAttendance(dto: SetAttendanceDto) {
    return this.attendance.upsertManual(dto.examTermId, dto.entries);
  }

  /* ================= internals ================= */

  private buildMarkRow(
    term: ExamTerms,
    syllabusSubjectId: string,
    row: MarkRowDto,
    component: { id: string; componentCode: string; maxRawMarks: Decimal; conversionWeightPct: Decimal; minPassMarks: Decimal },
    classRollNo: number | undefined,
    actorId: string,
  ) {
    const roll = classRollNo ?? '?';
    const isAbsent = Boolean(row.isAbsent);
    const isExempted = Boolean(row.isExempted);

    let raw = dec(row.rawMarksObtained ?? '0', 'rawMarksObtained');
    if (!isAbsent && !isExempted && raw.gt(component.maxRawMarks)) {
      throw new UnprocessableEntityException(
        `Roll ${roll}, component ${component.componentCode}: ${raw.toFixed(2)} exceeds max_raw_marks ${dec(component.maxRawMarks).toFixed(2)}`,
      );
    }
    if (isAbsent || isExempted) raw = new Decimal(0);
    const converted = round2(raw.mul(component.conversionWeightPct).div(100));
    const isPassedComponent = !isAbsent && (isExempted || converted.gte(component.minPassMarks));

    return {
      examTermId: term.id,
      studentId: row.studentId,
      syllabusSubjectId,
      componentId: component.id,
      rawMarksObtained: raw.toFixed(2),
      convertedMarks: converted.toFixed(2),
      isAbsent,
      isExempted,
      isPassedComponent,
      enteredBy: actorId,
    };
  }

  private async resolveRoster(term: ExamTerms, syllabusSubjectId: string, sectionOrBatchId?: string) {
    const subjectEnrollments = await this.prisma.studentSubjectEnrollments.findMany({
      where: { academicSessionId: term.academicSessionId, syllabusSubjectId },
      select: { studentId: true, assignedRole: true },
    });
    const subjectMap = new Map(subjectEnrollments.map((s) => [s.studentId, s.assignedRole]));
    const onlySubjectEnrolled = subjectMap.size > 0;

    const enrollments = await this.prisma.studentEnrollments.findMany({
      where: {
        academicSessionId: term.academicSessionId,
        classOrDeptId: term.classOrDeptId,
        isActive: true,
        ...(sectionOrBatchId ? { sectionOrBatchId } : {}),
      },
      include: { students: { select: { fullNameEn: true, studentUniqueId: true } } },
      orderBy: { classRollNo: 'asc' },
    });

    const rows: RosterRow[] = enrollments
      .filter((e) => !onlySubjectEnrolled || subjectMap.has(e.studentId))
      .map((e) => ({
        studentId: e.studentId,
        classRollNo: e.classRollNo,
        fullNameEn: e.students?.fullNameEn ?? null,
        studentUniqueId: e.students?.studentUniqueId ?? null,
        sectionOrBatchId: e.sectionOrBatchId,
        boardRegistrationNo: e.boardRegistrationNo,
        assignedRole: subjectMap.get(e.studentId) ?? null,
        subjectEnrolled: subjectMap.has(e.studentId),
      }));

    return { rows, rosterSource: onlySubjectEnrolled ? ('SUBJECT_ENROLLMENT' as const) : ('CLASS_ENROLLMENT' as const) };
  }

  private async getTerm(id: string): Promise<ExamTerms> {
    const term = await this.prisma.examTerms.findUnique({ where: { id } });
    if (!term) throw new NotFoundException(`Exam term #${id} not found`);
    return term;
  }

  private async getTermSubject(term: ExamTerms, syllabusSubjectId: string) {
    const subject = await this.prisma.classSyllabusSubjects.findFirst({
      where: { id: syllabusSubjectId, academicSessionId: term.academicSessionId, classOrDeptId: term.classOrDeptId },
      include: { academicSubjects: true },
    });
    if (!subject) {
      throw new BadRequestException(
        `Syllabus subject #${syllabusSubjectId} does not belong to this term's session and class`,
      );
    }
    return subject;
  }

  private assertEntryOpen(term: ExamTerms): void {
    if (term.status !== 'SETUP' && term.status !== 'MARKS_ENTRY') {
      throw new BadRequestException(
        `Marks entry is blocked while the term is ${term.status} (allowed: SETUP, MARKS_ENTRY)`,
      );
    }
  }
}
