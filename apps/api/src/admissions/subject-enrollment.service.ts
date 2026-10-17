import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type {
  AcademicSubjects,
  ClassSyllabusSubjects,
  StudentSubjectEnrollments,
} from '../generated/prisma/client';
import type { SyllabusSubjectRole } from '../database/entities/class-syllabus-subject.entity';
import type { AssignedSubjectRole } from '../database/entities/student-subject-enrollment.entity';
import {
  PASS_EVALUATION_MODES,
  findMergedGroupIssues,
  type MergedGroupRow,
} from './common/validators';

const SYLLABUS_ROLES: SyllabusSubjectRole[] = [
  'COMPULSORY',
  'GROUP_ELECTIVE',
  'FOURTH_OPTIONAL',
  'NON_CREDIT',
];

/** Syllabus row with Prisma's `academicSubjects` relation exposed under the entity's `subject` key. */
export type SyllabusRow = Omit<ClassSyllabusSubjects, 'academicSubjects'> & {
  subject?: AcademicSubjects | null;
};

/** Student subject enrollment with the entity's nested relation keys. */
export type StudentSubjectEnrollmentRow = Omit<StudentSubjectEnrollments, 'classSyllabusSubjects'> & {
  syllabusSubject?: SyllabusRow | null;
};

export interface SubjectPreviewRow {
  syllabusSubjectId: string;
  subjectCode: string;
  subjectName: string;
  paperNumber: number | null;
  combinedGroupCode: string | null;
  combinedGroupName: string | null;
  defaultRole: SyllabusSubjectRole;
  creditHours: string;
  fullMarks: string;
  locked: boolean;
}

/**
 * Workflow 3 — Automatic Subject & 4th-Subject Enrollment
 * (Admission Plan §4 Workflow 3, Result Plan §2 tables).
 *
 * preview(): COMPULSORY rows locked; GROUP_ELECTIVE rows matching the
 * student's academic_group auto-locked (enroll as COMPULSORY);
 * FOURTH_OPTIONAL rows offered as a single-pick (required whenever the
 * class matrix defines 4th options — the data-driven form of the
 * Class 9–12 rule). Credit mode = any row with credit_hours > 0
 * (University/semester checklist).
 *
 * enroll(): validates + writes student_subject_enrollments. Pre-admission
 * wizard selection is carried into Phase 3; this endpoint serves
 * already-admitted students (and Phase 3 will call the same logic).
 */
@Injectable()
export class SubjectEnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  /* ================= master subjects ================= */

  listMasterSubjects(boardStream?: string): Promise<AcademicSubjects[]> {
    return this.prisma.academicSubjects.findMany({
      where: boardStream ? { boardStream } : undefined,
      orderBy: [{ subjectCode: 'asc' }, { paperNumber: 'asc' }],
    });
  }

  async createMasterSubject(dto: {
    subjectCode: string; subjectName: string; boardStream?: string; paperNumber?: number | null;
  }): Promise<AcademicSubjects> {
    const clash = await this.prisma.academicSubjects.findFirst({
      where: { subjectCode: dto.subjectCode, paperNumber: dto.paperNumber ?? null },
    });
    if (clash) throw new BadRequestException(`Subject ${dto.subjectCode} paper ${dto.paperNumber ?? '—'} already exists`);
    return this.prisma.academicSubjects.create({
      data: {
        subjectCode: dto.subjectCode,
        subjectName: dto.subjectName,
        boardStream: dto.boardStream ?? 'GENERAL',
        paperNumber: dto.paperNumber ?? null,
      },
    });
  }

  async updateMasterSubject(
    id: string,
    dto: { subjectCode?: string; subjectName?: string; boardStream?: string; paperNumber?: number | null },
  ): Promise<AcademicSubjects> {
    const existing = await this.prisma.academicSubjects.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Academic subject #${id} not found`);
    const nextCode = dto.subjectCode ?? existing.subjectCode;
    const nextPaper = dto.paperNumber === undefined ? existing.paperNumber : dto.paperNumber;
    if (nextCode !== existing.subjectCode || nextPaper !== existing.paperNumber) {
      const clash = await this.prisma.academicSubjects.findFirst({
        where: { subjectCode: nextCode, paperNumber: nextPaper, id: { not: id } },
      });
      if (clash) {
        throw new BadRequestException(`Subject ${nextCode} paper ${nextPaper ?? '—'} already exists`);
      }
    }
    return this.prisma.academicSubjects.update({
      where: { id },
      data: {
        subjectCode: dto.subjectCode ?? undefined,
        subjectName: dto.subjectName ?? undefined,
        boardStream: dto.boardStream ?? undefined,
        paperNumber: dto.paperNumber === undefined ? undefined : dto.paperNumber,
      },
    });
  }

  async deleteMasterSubject(id: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.academicSubjects.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Academic subject #${id} not found`);
    const used = await this.prisma.classSyllabusSubjects.count({ where: { subjectId: id } });
    if (used > 0) {
      throw new BadRequestException(
        `Subject ${existing.subjectCode} is used by ${used} syllabus row(s) — remove those first`,
      );
    }
    await this.prisma.academicSubjects.delete({ where: { id } });
    return { deleted: true as const };
  }

  /* ================= syllabus matrix ================= */

  async listSyllabus(academicSessionId: string, classOrDeptId: string): Promise<SyllabusRow[]> {
    const rows = await this.prisma.classSyllabusSubjects.findMany({
      where: { academicSessionId, classOrDeptId },
      include: { academicSubjects: true },
      orderBy: { displayOrder: 'asc' },
    });
    return rows.map(toSyllabusRow);
  }

  async upsertSyllabusRow(
    dto: {
      academicSessionId: string; classOrDeptId: string; subjectId: string;
      combinedGroupCode?: string | null; combinedGroupName?: string | null;
      defaultSubjectRole: string; electiveGroup?: string | null; creditHours?: string;
      fullMarks?: string; passEvaluationMode?: string; displayOrder?: number;
    },
    /** Result Engine bulk/clone paths pass a transaction client (no nested txn). */
    tx?: Prisma.TransactionClient,
  ): Promise<ClassSyllabusSubjects> {
    const db = tx ?? this.prisma;
    if (!(SYLLABUS_ROLES as string[]).includes(dto.defaultSubjectRole)) {
      throw new BadRequestException(`defaultSubjectRole must be one of ${SYLLABUS_ROLES.join(', ')}`);
    }
    const passEvaluationMode = dto.passEvaluationMode ?? 'SEPARATE_COMPONENTS';
    if (!(PASS_EVALUATION_MODES as readonly string[]).includes(passEvaluationMode)) {
      throw new BadRequestException(`passEvaluationMode must be one of ${PASS_EVALUATION_MODES.join(', ')}`);
    }
    const subject = await db.academicSubjects.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new NotFoundException(`Academic subject #${dto.subjectId} not found`);
    if (dto.defaultSubjectRole === 'GROUP_ELECTIVE' && !dto.electiveGroup) {
      throw new BadRequestException('GROUP_ELECTIVE rows need electiveGroup (e.g. SCIENCE)');
    }
    const values = {
      combinedGroupCode: dto.combinedGroupCode ?? null,
      combinedGroupName: dto.combinedGroupName ?? null,
      defaultSubjectRole: dto.defaultSubjectRole,
      electiveGroup: dto.electiveGroup ?? null,
      creditHours: this.dec(dto.creditHours ?? '0', 'creditHours'),
      fullMarks: this.dec(dto.fullMarks ?? '100', 'fullMarks'),
      passEvaluationMode,
      displayOrder: dto.displayOrder ?? 1,
    };
    // Combined-paper rule (§PHASE 2 task 3): validate the whole class scope with
    // this row applied on top of its peers, so a bad merge is rejected before
    // anything is written.
    const peers = await db.classSyllabusSubjects.findMany({
      where: { academicSessionId: dto.academicSessionId, classOrDeptId: dto.classOrDeptId },
    });
    const existing = peers.find((r) => r.subjectId === dto.subjectId) ?? null;
    const prospective: MergedGroupRow[] = peers
      .filter((r) => r.subjectId !== dto.subjectId)
      .map((r) => ({
        subjectId: r.subjectId,
        combinedGroupCode: r.combinedGroupCode,
        passEvaluationMode: r.passEvaluationMode,
        defaultSubjectRole: r.defaultSubjectRole,
      }));
    prospective.push({
      subjectId: dto.subjectId,
      combinedGroupCode: values.combinedGroupCode,
      passEvaluationMode: values.passEvaluationMode,
      defaultSubjectRole: values.defaultSubjectRole,
    });
    this.assertMergedGroups(prospective, dto.classOrDeptId);
    if (existing) {
      return db.classSyllabusSubjects.update({ where: { id: existing.id }, data: values });
    }
    return db.classSyllabusSubjects.create({
      data: {
        academicSessionId: dto.academicSessionId,
        classOrDeptId: dto.classOrDeptId,
        subjectId: dto.subjectId,
        ...values,
      },
    });
  }

  async removeSyllabusRow(id: string): Promise<{ deleted: true }> {
    const row = await this.prisma.classSyllabusSubjects.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Syllabus row #${id} not found`);
    const used = await this.prisma.studentSubjectEnrollments.count({
      where: { syllabusSubjectId: id },
    });
    if (used > 0) {
      throw new BadRequestException(`Row is used by ${used} student enrollment(s) — deactivate via Result Engine instead`);
    }
    await this.prisma.classSyllabusSubjects.delete({ where: { id } });
    return { deleted: true as const };
  }

  /* ================= combined-paper validation (Result Engine §PHASE 2) ================= */

  /** Throws a descriptive 400 when any combined-paper group in the scope is inconsistent. */
  assertMergedGroups(rows: MergedGroupRow[], classOrDeptId: string): void {
    const issues = findMergedGroupIssues(rows);
    if (issues.length) {
      throw new BadRequestException(
        `Combined-paper group conflict in class ${classOrDeptId}: ${issues.map((i) => i.message).join('; ')}`,
      );
    }
  }

  /** Read-only report for the syllabus-matrix UI (`valid` + per-group paper list). */
  async validateSyllabusMergedGroups(academicSessionId: string, classOrDeptId: string) {
    const rows = await this.prisma.classSyllabusSubjects.findMany({
      where: { academicSessionId, classOrDeptId },
      include: { academicSubjects: true },
      orderBy: { displayOrder: 'asc' },
    });
    const issues = findMergedGroupIssues(
      rows.map((r) => ({
        subjectId: r.subjectId,
        combinedGroupCode: r.combinedGroupCode,
        passEvaluationMode: r.passEvaluationMode,
        defaultSubjectRole: r.defaultSubjectRole,
      })),
    );
    const groupsMap = new Map<
      string,
      {
        groupCode: string;
        combinedGroupName: string | null;
        passEvaluationMode: string;
        defaultSubjectRole: string;
        papers: { subjectId: string; subjectCode: string; subjectName: string; paperNumber: number | null }[];
      }
    >();
    for (const r of rows) {
      if (!r.combinedGroupCode) continue;
      const group = groupsMap.get(r.combinedGroupCode) ?? {
        groupCode: r.combinedGroupCode,
        combinedGroupName: r.combinedGroupName,
        passEvaluationMode: r.passEvaluationMode,
        defaultSubjectRole: r.defaultSubjectRole,
        papers: [],
      };
      group.papers.push({
        subjectId: r.subjectId,
        subjectCode: r.academicSubjects?.subjectCode ?? '?',
        subjectName: r.academicSubjects?.subjectName ?? '?',
        paperNumber: r.academicSubjects?.paperNumber ?? null,
      });
      groupsMap.set(r.combinedGroupCode, group);
    }
    return { valid: issues.length === 0, issues, groups: [...groupsMap.values()], rows: rows.length };
  }

  /* ================= wizard preview ================= */

  async preview(academicSessionId: string, classOrDeptId: string, academicGroup?: string) {
    const rows = await this.listSyllabus(academicSessionId, classOrDeptId);
    const group = (academicGroup ?? '').trim().toUpperCase();
    const toRow = (r: SyllabusRow, locked: boolean): SubjectPreviewRow => ({
      syllabusSubjectId: r.id,
      subjectCode: r.subject?.subjectCode ?? '?',
      subjectName: r.subject?.subjectName ?? '?',
      paperNumber: r.subject?.paperNumber ?? null,
      combinedGroupCode: r.combinedGroupCode ?? null,
      combinedGroupName: r.combinedGroupName ?? null,
      defaultRole: r.defaultSubjectRole as SyllabusSubjectRole,
      creditHours: String(r.creditHours),
      fullMarks: String(r.fullMarks),
      locked,
    });
    const compulsory = rows.filter((r) => r.defaultSubjectRole === 'COMPULSORY').map((r) => toRow(r, true));
    const groupElectives = rows
      .filter((r) => r.defaultSubjectRole === 'GROUP_ELECTIVE' && (!r.electiveGroup || (group && r.electiveGroup === group)))
      .map((r) => toRow(r, true));
    const otherElectives = rows
      .filter((r) => r.defaultSubjectRole === 'GROUP_ELECTIVE' && r.electiveGroup && r.electiveGroup !== group)
      .map((r) => toRow(r, false));
    const fourthOptions = rows.filter((r) => r.defaultSubjectRole === 'FOURTH_OPTIONAL').map((r) => toRow(r, false));
    const nonCredit = rows.filter((r) => r.defaultSubjectRole === 'NON_CREDIT').map((r) => toRow(r, true));
    const creditMode = rows.some((r) => new Decimal(String(r.creditHours)).gt(0));
    const totalCredits = rows
      .reduce((t, r) => t.plus(new Decimal(String(r.creditHours))), new Decimal(0))
      .toFixed(2);
    return {
      compulsory,
      groupElectives,
      otherElectives,
      fourthOptions,
      nonCredit,
      requiresFourth: fourthOptions.length > 0,
      creditMode,
      totalCredits,
      lockedIds: [...compulsory, ...groupElectives, ...nonCredit].map((r) => r.syllabusSubjectId),
    };
  }

  /* ================= enrollment write ================= */

  async enroll(
    studentId: string,
    academicSessionId: string,
    syllabusSubjectIds: string[],
    /** Workflow 4 passes the onboarding transaction client (no nested txn). */
    tx?: Prisma.TransactionClient,
    /**
     * Result Engine bulk-enroll passes `{ requireFourth: false }` to stage a
     * class's compulsory set first and assign each student's 4th subject later
     * (the wizard keeps the default `true`).
     */
    options?: { requireFourth?: boolean },
  ) {
    if (!syllabusSubjectIds.length) throw new BadRequestException('Select at least one subject');
    const db = tx ?? this.prisma;
    const unique = Array.from(new Set(syllabusSubjectIds));
    const rows = await db.classSyllabusSubjects.findMany({
      where: { id: { in: unique } },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException('One or more syllabus rows do not exist');
    }
    const sessions = new Set(rows.map((r) => r.academicSessionId));
    if (sessions.size !== 1 || !sessions.has(academicSessionId)) {
      throw new BadRequestException('All subjects must belong to the same admission session');
    }
    const classes = new Set(rows.map((r) => r.classOrDeptId));
    if (classes.size !== 1) {
      throw new BadRequestException('All subjects must belong to one class/department');
    }
    // 4th-subject rule: whenever the class matrix defines FOURTH_OPTIONAL
    // candidates, exactly one must be picked (Class 9–12 SSC/Dakhil/HSC rule).
    const classScope = await db.classSyllabusSubjects.findMany({
      where: { academicSessionId, classOrDeptId: rows[0].classOrDeptId },
    });
    const fourthCandidates = classScope.filter((r) => r.defaultSubjectRole === 'FOURTH_OPTIONAL');
    const pickedFourth = rows.filter((r) => r.defaultSubjectRole === 'FOURTH_OPTIONAL');
    const requireFourth = options?.requireFourth ?? true;
    if (pickedFourth.length > 1) {
      throw new BadRequestException(
        `This class allows exactly 1 optional (4th) subject — picked ${pickedFourth.length}`,
      );
    }
    if (requireFourth && fourthCandidates.length > 0 && pickedFourth.length !== 1) {
      throw new BadRequestException(
        `This class requires exactly 1 optional (4th) subject — picked ${pickedFourth.length}`,
      );
    }
    const roleOf = (r: ClassSyllabusSubjects): AssignedSubjectRole =>
      r.defaultSubjectRole === 'FOURTH_OPTIONAL' ? 'FOURTH_OPTIONAL'
      : r.defaultSubjectRole === 'NON_CREDIT' ? 'NON_CREDIT'
      : 'COMPULSORY';
    const saved: StudentSubjectEnrollments[] = [];
    for (const r of rows) {
      const existing = await db.studentSubjectEnrollments.findFirst({
        where: { academicSessionId, studentId, syllabusSubjectId: r.id },
      });
      if (existing) {
        if (existing.assignedRole !== roleOf(r)) {
          saved.push(
            await db.studentSubjectEnrollments.update({
              where: { id: existing.id },
              data: { assignedRole: roleOf(r) },
            }),
          );
        } else {
          saved.push(existing);
        }
        continue;
      }
      saved.push(
        await db.studentSubjectEnrollments.create({
          data: {
            academicSessionId,
            studentId,
            syllabusSubjectId: r.id,
            assignedRole: roleOf(r),
          },
        }),
      );
    }
    return { enrolled: saved.length, rows: saved };
  }

  async listStudentEnrollments(
    studentId: string,
    academicSessionId?: string,
  ): Promise<StudentSubjectEnrollmentRow[]> {
    const rows = await this.prisma.studentSubjectEnrollments.findMany({
      where: academicSessionId ? { studentId, academicSessionId } : { studentId },
      include: { classSyllabusSubjects: { include: { academicSubjects: true } } },
    });
    return rows.map((row) => {
      const { classSyllabusSubjects, ...rest } = row;
      return {
        ...rest,
        syllabusSubject: classSyllabusSubjects ? toSyllabusRow(classSyllabusSubjects) : null,
      };
    });
  }

  /**
   * Step-3 roll preview: current max + 1 for the scope (read-only, advisory —
   * the final roll is reserved under FOR UPDATE at confirm time).
   */
  async peekRoll(academicSessionId: string, classOrDeptId: string, sectionOrBatchId?: string) {
    const agg = await this.prisma.studentEnrollments.aggregate({
      where: {
        academicSessionId,
        classOrDeptId,
        sectionOrBatchId: sectionOrBatchId ?? null,
      },
      _max: { classRollNo: true },
    });
    const max = agg._max.classRollNo ?? 0;
    return { previewRoll: max + 1, scopeHighest: max };
  }

  private dec(raw: string, tag: string): string {
    let d: Decimal;
    try {
      d = new Decimal(raw);
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid decimal`);
    }
    if (!d.isFinite() || d.isNegative()) throw new BadRequestException(`${tag} must be non-negative`);
    return d.toFixed(2);
  }
}

function toSyllabusRow(row: ClassSyllabusSubjects & { academicSubjects?: AcademicSubjects | null }): SyllabusRow {
  const { academicSubjects, ...rest } = row;
  return { ...rest, subject: academicSubjects ?? null };
}
