import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { dec } from '../common/decimal.util';

export interface PreFlightBlocker {
  code: string;
  message: string;
  syllabusSubjectId?: string;
  componentCode?: string;
  missingStudents?: number;
}

export interface PreFlightReport {
  examTermId: string;
  termStatus: string;
  termType: string;
  ok: boolean;
  students: number;
  subjects: number;
  components: number;
  blockers: PreFlightBlocker[];
}

/**
 * Pre-flight validation exposed to the console (CC-17, CC-19, AD-4, AD-7).
 * Runs before a generation job is queued so blocking problems surface as a
 * readable list instead of a failed job.
 */
@Injectable()
export class PreFlightService {
  constructor(private readonly prisma: PrismaService) {}

  async check(examTermId: string): Promise<PreFlightReport> {
    const term = await this.prisma.examTerms.findUnique({ where: { id: examTermId } });
    if (!term) throw new NotFoundException(`Exam term #${examTermId} not found`);

    const blockers: PreFlightBlocker[] = [];
    const isCumulative = term.termType === 'CUMULATIVE_ANNUAL';

    const subjectRows = await this.prisma.classSyllabusSubjects.findMany({
      where: { academicSessionId: term.academicSessionId, classOrDeptId: term.classOrDeptId },
      orderBy: { displayOrder: 'asc' },
    });
    const componentRows = await this.prisma.examSubjectComponents.findMany({ where: { examTermId } });
    const enrollments = await this.prisma.studentEnrollments.findMany({
      where: {
        academicSessionId: term.academicSessionId,
        classOrDeptId: term.classOrDeptId,
        isActive: true,
      },
      select: { studentId: true },
    });

    if (term.status !== 'MARKS_ENTRY') {
      blockers.push({
        code: 'TERM_NOT_IN_MARKS_ENTRY',
        message: `Generation is only allowed from MARKS_ENTRY (term is ${term.status})`,
      });
    }
    if (!enrollments.length) {
      blockers.push({ code: 'NO_ENROLLED_STUDENTS', message: 'No active students are enrolled in this class/session' });
    }
    if (!subjectRows.length) {
      blockers.push({ code: 'NO_SYLLABUS_SUBJECTS', message: 'No class syllabus subjects are configured' });
    }

    const componentsBySubject = new Map<string, typeof componentRows>();
    for (const component of componentRows) {
      const list = componentsBySubject.get(component.syllabusSubjectId) ?? [];
      list.push(component);
      componentsBySubject.set(component.syllabusSubjectId, list);
    }

    if (isCumulative) {
      await this.checkCumulative(examTermId, blockers);
    } else {
      this.checkComponents(subjectRows, componentsBySubject, blockers);
      if (enrollments.length) await this.checkMarksCompleteness(term, subjectRows, componentsBySubject, blockers);
      await this.checkAutoSources(term, componentsBySubject, enrollments.length, blockers);
    }

    return {
      examTermId,
      termStatus: term.status,
      termType: term.termType,
      ok: blockers.length === 0,
      students: enrollments.length,
      subjects: subjectRows.length,
      components: componentRows.length,
      blockers,
    };
  }

  /** CC-17 — every subject's component converted-max set must equal `full_marks`. */
  private checkComponents(
    subjectRows: Array<{ id: string; fullMarks: unknown }>,
    componentsBySubject: Map<string, Array<{ componentCode: string; convertedMaxMarks: unknown }>>,
    blockers: PreFlightBlocker[],
  ): void {
    for (const subject of subjectRows) {
      const components = componentsBySubject.get(subject.id) ?? [];
      if (!components.length) {
        blockers.push({
          code: 'NO_COMPONENTS',
          message: 'Subject has no components configured',
          syllabusSubjectId: subject.id,
        });
        continue;
      }
      const total = components.reduce(
        (acc, component) => acc.plus(new Decimal(String(component.convertedMaxMarks ?? 0))),
        new Decimal(0),
      );
      const full = new Decimal(String(subject.fullMarks ?? 0));
      if (!total.eq(full)) {
        blockers.push({
          code: 'COMPONENT_SUM_MISMATCH',
          message: `Σ converted_max_marks ${total.toFixed(2)} ≠ full_marks ${full.toFixed(2)}`,
          syllabusSubjectId: subject.id,
        });
      }
    }
  }

  /** CC-19 — every enrolled student must have a row for every component. */
  private async checkMarksCompleteness(
    term: { id: string; academicSessionId: string },
    subjectRows: Array<{ id: string }>,
    componentsBySubject: Map<string, Array<{ id: string; componentCode: string }>>,
    blockers: PreFlightBlocker[],
  ): Promise<void> {
    const subjectEnrollments = await this.prisma.studentSubjectEnrollments.findMany({
      where: { academicSessionId: term.academicSessionId, syllabusSubjectId: { in: subjectRows.map((s) => s.id) } },
      select: { studentId: true, syllabusSubjectId: true },
    });
    const rosterBySubject = new Map<string, Set<string>>();
    for (const enrollment of subjectEnrollments) {
      const set = rosterBySubject.get(enrollment.syllabusSubjectId) ?? new Set<string>();
      set.add(enrollment.studentId);
      rosterBySubject.set(enrollment.syllabusSubjectId, set);
    }

    const markRows = await this.prisma.studentComponentMarks.findMany({
      where: { examTermId: term.id },
      select: { studentId: true, componentId: true },
    });
    const marked = new Set(markRows.map((row) => `${row.studentId}:${row.componentId}`));

    for (const subject of subjectRows) {
      const roster = rosterBySubject.get(subject.id);
      if (!roster?.size) continue;
      for (const component of componentsBySubject.get(subject.id) ?? []) {
        let missing = 0;
        for (const studentId of roster) if (!marked.has(`${studentId}:${component.id}`)) missing += 1;
        if (missing) {
          blockers.push({
            code: 'MISSING_COMPONENT_MARKS',
            message: `${missing} student(s) have no mark row for ${component.componentCode}`,
            syllabusSubjectId: subject.id,
            componentCode: component.componentCode,
            missingStudents: missing,
          });
        }
      }
    }
  }

  /** CC-06 / AD-4 — auto sources need children / attendance summaries to draw from. */
  private async checkAutoSources(
    term: { id: string },
    componentsBySubject: Map<string, Array<{ componentCode: string; sourceType: string }>>,
    enrolledCount: number,
    blockers: PreFlightBlocker[],
  ): Promise<void> {
    const all = [...componentsBySubject.values()].flat();
    if (all.some((component) => component.sourceType === 'AUTO_FROM_SUB_EXAMS')) {
      const children = await this.prisma.examTerms.count({ where: { parentTerminalExamId: term.id } });
      if (children === 0) {
        blockers.push({
          code: 'CT_HAS_NO_CHILD_TERMS',
          message: 'AUTO_FROM_SUB_EXAMS component exists but this term has no child terms (k = 0)',
        });
      }
    }
    if (enrolledCount && all.some((component) => component.sourceType === 'AUTO_FROM_ATTENDANCE')) {
      const summaries = await this.prisma.studentAttendanceSummaries.count({ where: { examTermId: term.id } });
      if (summaries < enrolledCount) {
        blockers.push({
          code: 'ATTENDANCE_SUMMARY_MISSING',
          message: `Only ${summaries}/${enrolledCount} attendance summaries are recorded (AD-4)`,
          missingStudents: Math.max(0, enrolledCount - summaries),
        });
      }
    }
  }

  /** AD-7 — cumulative-annual parents need complete weights and published children. */
  private async checkCumulative(examTermId: string, blockers: PreFlightBlocker[]): Promise<void> {
    const weights = await this.prisma.examTermWeights.findMany({ where: { parentExamTermId: examTermId } });
    if (!weights.length) {
      blockers.push({
        code: 'CUMULATIVE_NO_WEIGHTS',
        message: 'CUMULATIVE_ANNUAL term has no child-term weights (AD-7)',
      });
      return;
    }
    const total = weights.reduce((acc, weight) => acc.plus(dec(weight.weightPct)), new Decimal(0));
    if (!total.eq(100)) {
      blockers.push({
        code: 'CUMULATIVE_WEIGHTS_NOT_100',
        message: `Σ child weights ${total.toFixed(2)} ≠ 100.00`,
      });
    }
    const childIds = weights.map((weight) => weight.childExamTermId);
    const published = await this.prisma.examTerms.count({
      where: { id: { in: childIds }, status: { in: ['PUBLISHED', 'LOCKED'] } },
    });
    if (published !== childIds.length) {
      blockers.push({
        code: 'CUMULATIVE_CHILD_NOT_PUBLISHED',
        message: `Only ${published}/${childIds.length} child terms are published`,
      });
    }
  }
}
