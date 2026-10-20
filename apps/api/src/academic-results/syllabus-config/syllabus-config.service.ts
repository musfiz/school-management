import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubjectEnrollmentService } from '../../admissions/subject-enrollment.service';
import { findMergedGroupIssues } from '../../admissions/common/validators';
import type { UpsertSyllabusRowDto } from '../../admissions/admissions.dto';
import type {
  BulkEnrollDto,
  CloneSyllabusDto,
  UpdateMasterSubjectDto,
} from './syllabus-config.dto';

/**
 * Result Engine §PHASE 2 — syllabus, paper-merger & enrollment APIs.
 *
 * Master-subject and per-row syllabus CRUD (including the combined-paper
 * validation) live in the shared `SubjectEnrollmentService` so the admission
 * wizard and the Result Engine cannot drift apart. This service adds the
 * Result-Engine-only operations on top:
 *   - bulk syllabus upsert (one transaction),
 *   - clone a whole session's syllabus from a previous session,
 *   - bulk-enroll a class/section's compulsory set + per-student 4th subject.
 */
@Injectable()
export class SyllabusConfigService implements OnModuleInit {
  private tablesEnsured = false;
  private readonly logger = new Logger(SyllabusConfigService.name);

  constructor(
    private readonly subjects: SubjectEnrollmentService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  async ensureTables(): Promise<void> {
    if (this.tablesEnsured) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`academic_subjects\` (
          \`id\` CHAR(36) NOT NULL,
          \`subject_code\` VARCHAR(30) NOT NULL,
          \`subject_name\` VARCHAR(150) NOT NULL,
          \`board_stream\` VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
          \`paper_number\` INT NULL,
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_SUBJECTS_CODE\`(\`subject_code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_general_ci;
      `);

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO \`academic_subjects\` (\`id\`, \`subject_code\`, \`subject_name\`, \`board_stream\`, \`paper_number\`)
        SELECT UUID(), code, name, stream, paper FROM (
          SELECT '101' AS code, 'Bangla 1st Paper' AS name, 'GENERAL' AS stream, 1 AS paper UNION ALL
          SELECT '102', 'Bangla 2nd Paper', 'GENERAL', 2 UNION ALL
          SELECT '107', 'English 1st Paper', 'GENERAL', 1 UNION ALL
          SELECT '108', 'English 2nd Paper', 'GENERAL', 2 UNION ALL
          SELECT '109', 'Mathematics', 'GENERAL', NULL UNION ALL
          SELECT '111', 'Islam & Moral Education', 'GENERAL', NULL UNION ALL
          SELECT '127', 'General Science', 'GENERAL', NULL UNION ALL
          SELECT '136', 'Physics', 'SCIENCE', 1 UNION ALL
          SELECT '137', 'Chemistry', 'SCIENCE', 1 UNION ALL
          SELECT '138', 'Biology', 'SCIENCE', 1 UNION ALL
          SELECT '126', 'Higher Mathematics', 'SCIENCE', NULL UNION ALL
          SELECT '150', 'Bangladesh & Global Studies', 'GENERAL', NULL UNION ALL
          SELECT '154', 'Information & Communication Technology', 'GENERAL', NULL
        ) seed
        WHERE NOT EXISTS (SELECT 1 FROM \`academic_subjects\` s WHERE s.\`subject_code\` = seed.\`code\` AND (s.\`paper_number\` = seed.\`paper\` OR (s.\`paper_number\` IS NULL AND seed.\`paper\` IS NULL)));
      `);

      this.tablesEnsured = true;
    } catch (error) {
      this.logger.error('Failed to ensure academic_subjects table:', error);
    }
  }

  /* ================= master subjects (delegated) ================= */

  async listMasterSubjects(boardStream?: string) {
    await this.ensureTables();
    try {
      return await this.subjects.listMasterSubjects(boardStream);
    } catch (err) {
      this.logger.error('listMasterSubjects query error:', err);
      return [];
    }
  }

  createMasterSubject(dto: {
    subjectCode: string;
    subjectName: string;
    boardStream?: string;
    paperNumber?: number | null;
  }) {
    return this.subjects.createMasterSubject(dto);
  }

  updateMasterSubject(id: string, dto: UpdateMasterSubjectDto) {
    return this.subjects.updateMasterSubject(id, dto);
  }

  deleteMasterSubject(id: string) {
    return this.subjects.deleteMasterSubject(id);
  }

  /* ================= syllabus matrix (delegated) ================= */

  listSyllabus(academicSessionId: string, classOrDeptId: string) {
    return this.subjects.listSyllabus(academicSessionId, classOrDeptId);
  }

  upsertSyllabusRow(dto: UpsertSyllabusRowDto) {
    return this.subjects.upsertSyllabusRow(dto);
  }

  removeSyllabusRow(id: string) {
    return this.subjects.removeSyllabusRow(id);
  }

  validateSyllabus(academicSessionId: string, classOrDeptId: string) {
    return this.subjects.validateSyllabusMergedGroups(academicSessionId, classOrDeptId);
  }

  /** Upserts many rows atomically; a bad merge anywhere rolls the whole batch back. */
  async bulkUpsertSyllabusRows(rows: UpsertSyllabusRowDto[]) {
    if (!rows.length) throw new BadRequestException('rows must not be empty');
    const saved = await this.prisma.$transaction(async (tx) => {
      const out = [];
      for (const row of rows) {
        out.push(await this.subjects.upsertSyllabusRow(row, tx));
      }
      return out;
    });
    return { saved: saved.length, rows: saved };
  }

  /**
   * Copies `class_syllabus_subjects` rows from a source session to a target
   * session. Existing target rows (same class + subject) are left untouched;
   * the target scope is re-validated inside the same transaction, so an
   * inconsistent result rolls back.
   */
  async cloneSyllabus(dto: CloneSyllabusDto) {
    const { sourceAcademicSessionId, targetAcademicSessionId, classOrDeptIds } = dto;
    if (sourceAcademicSessionId === targetAcademicSessionId) {
      throw new BadRequestException('Source and target academic sessions must differ');
    }
    const sourceRows = await this.prisma.classSyllabusSubjects.findMany({
      where: {
        academicSessionId: sourceAcademicSessionId,
        ...(classOrDeptIds?.length ? { classOrDeptId: { in: classOrDeptIds } } : {}),
      },
      orderBy: { displayOrder: 'asc' },
    });
    if (!sourceRows.length) {
      throw new BadRequestException('No syllabus rows found in the source session for the selected scope');
    }
    const affectedClasses = [...new Set(sourceRows.map((r) => r.classOrDeptId))];

    const result = await this.prisma.$transaction(async (tx) => {
      let copied = 0;
      let skipped = 0;
      for (const row of sourceRows) {
        const existing = await tx.classSyllabusSubjects.findFirst({
          where: {
            academicSessionId: targetAcademicSessionId,
            classOrDeptId: row.classOrDeptId,
            subjectId: row.subjectId,
          },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        await tx.classSyllabusSubjects.create({
          data: {
            academicSessionId: targetAcademicSessionId,
            classOrDeptId: row.classOrDeptId,
            subjectId: row.subjectId,
            combinedGroupCode: row.combinedGroupCode,
            combinedGroupName: row.combinedGroupName,
            defaultSubjectRole: row.defaultSubjectRole,
            electiveGroup: row.electiveGroup,
            creditHours: row.creditHours,
            fullMarks: row.fullMarks,
            passEvaluationMode: row.passEvaluationMode,
            displayOrder: row.displayOrder,
          },
        });
        copied += 1;
      }

      // Re-validate the merged target scope before committing.
      for (const classOrDeptId of affectedClasses) {
        const targetRows = await tx.classSyllabusSubjects.findMany({
          where: { academicSessionId: targetAcademicSessionId, classOrDeptId },
          select: {
            subjectId: true,
            combinedGroupCode: true,
            passEvaluationMode: true,
            defaultSubjectRole: true,
          },
        });
        const issues = findMergedGroupIssues(targetRows);
        if (issues.length) {
          throw new BadRequestException(
            `Clone would produce a combined-paper conflict in class ${classOrDeptId}: ${issues
              .map((i) => i.message)
              .join('; ')}`,
          );
        }
      }

      return { copied, skipped, classes: affectedClasses.length };
    });

    return { ...result, sourceSessionId: sourceAcademicSessionId, targetSessionId: targetAcademicSessionId };
  }

  /* ================= bulk enrollment ================= */

  /**
   * Enrolls every active student of a class/section in the class's
   * COMPULSORY + matching GROUP_ELECTIVE + NON_CREDIT rows, plus the student's
   * chosen 4th subject. Reuses `SubjectEnrollmentService.enroll()` for the
   * uniqueness guard and the exactly-one-4th rule. `dryRun` reports the plan
   * without writing.
   */
  async bulkEnroll(dto: BulkEnrollDto) {
    const { academicSessionId, classOrDeptId, sectionOrBatchId, fourthSubjectByStudent, dryRun } = dto;

    const enrollments = await this.prisma.studentEnrollments.findMany({
      where: {
        academicSessionId,
        classOrDeptId,
        isActive: true,
        ...(sectionOrBatchId ? { sectionOrBatchId } : {}),
      },
      select: { studentId: true, academicGroup: true, classRollNo: true },
      orderBy: { classRollNo: 'asc' },
    });
    if (!enrollments.length) {
      throw new BadRequestException('No active students found for this class/section in the session');
    }

    const syllabus = await this.subjects.listSyllabus(academicSessionId, classOrDeptId);
    if (!syllabus.length) {
      throw new BadRequestException('No syllabus matrix configured for this class in the session');
    }

    const compulsory = syllabus.filter((r) => r.defaultSubjectRole === 'COMPULSORY');
    const nonCredit = syllabus.filter((r) => r.defaultSubjectRole === 'NON_CREDIT');
    const electives = syllabus.filter((r) => r.defaultSubjectRole === 'GROUP_ELECTIVE');
    const fourthCandidates = syllabus.filter((r) => r.defaultSubjectRole === 'FOURTH_OPTIONAL');
    const fourthIds = new Set(fourthCandidates.map((r) => r.id));
    const fourthByStudent = new Map(
      (fourthSubjectByStudent ?? []).map((p) => [p.studentId, p.syllabusSubjectId]),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const enrollment of enrollments) {
      const group = (enrollment.academicGroup ?? '').trim().toUpperCase();
      const matchingElectives = electives.filter(
        (r) => !r.electiveGroup || r.electiveGroup.trim().toUpperCase() === group,
      );
      const baseIds = [...compulsory, ...matchingElectives, ...nonCredit].map((r) => r.id);
      const chosenFourth = fourthByStudent.get(enrollment.studentId) ?? null;

      if (chosenFourth && !fourthIds.has(chosenFourth)) {
        results.push({
          studentId: enrollment.studentId,
          classRollNo: enrollment.classRollNo,
          status: 'ERROR',
          message: `syllabusSubjectId ${chosenFourth} is not a FOURTH_OPTIONAL row of this class`,
        });
        continue;
      }

      const needsFourth = fourthCandidates.length > 0 && !chosenFourth;
      const ids = chosenFourth ? [...baseIds, chosenFourth] : baseIds;

      if (dryRun) {
        results.push({
          studentId: enrollment.studentId,
          classRollNo: enrollment.classRollNo,
          status: needsFourth ? 'NEEDS_FOURTH' : 'READY',
          subjects: ids.length,
        });
        continue;
      }

      try {
        const res = await this.subjects.enroll(
          enrollment.studentId,
          academicSessionId,
          ids,
          undefined,
          { requireFourth: !needsFourth },
        );
        results.push({
          studentId: enrollment.studentId,
          classRollNo: enrollment.classRollNo,
          status: needsFourth ? 'PARTIAL_NEEDS_FOURTH' : 'ENROLLED',
          subjects: res.enrolled,
        });
      } catch (err) {
        results.push({
          studentId: enrollment.studentId,
          classRollNo: enrollment.classRollNo,
          status: 'ERROR',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const count = (status: string) => results.filter((r) => r.status === status).length;
    return {
      dryRun: Boolean(dryRun),
      summary: {
        students: enrollments.length,
        enrolled: count('ENROLLED'),
        partialNeedsFourth: count('PARTIAL_NEEDS_FOURTH'),
        needsFourth: count('NEEDS_FOURTH'),
        ready: count('READY'),
        errors: count('ERROR'),
      },
      results,
    };
  }

  listStudentEnrollments(studentId: string, academicSessionId?: string) {
    return this.subjects.listStudentEnrollments(studentId, academicSessionId);
  }
}
