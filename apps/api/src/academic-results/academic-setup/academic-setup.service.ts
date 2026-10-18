import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateAcademicSessionDto,
  CreateClassOrDeptDto,
  CreateExamTermTypeDto,
  UpdateAcademicSessionDto,
  UpdateClassOrDeptDto,
  UpdateExamTermTypeDto,
} from './academic-setup.dto';
import { CLASS_LEVELS, ENGINE_BEHAVIORS } from './academic-setup.dto';

/**
 * Result Engine — academic scope master data.
 *
 * `academic_session_id` and `class_or_dept_id` were opaque UUIDs typed by hand
 * (or derived from whatever rows happened to exist) until this module landed.
 * These master tables give officers a real entry + list screen; every
 * other screen keeps working unchanged because it passes the same UUIDs — only
 * the lookups endpoint now resolves them to human names.
 */
@Injectable()
export class AcademicSetupService implements OnModuleInit {
  private tablesEnsured = false;
  private readonly logger = new Logger(AcademicSetupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  /**
   * Idempotently creates master tables if migrations haven't run on the DB.
   */
  async ensureTables(): Promise<void> {
    if (this.tablesEnsured) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`academic_sessions\` (
          \`id\` CHAR(36) NOT NULL,
          \`session_name\` VARCHAR(50) NOT NULL,
          \`session_code\` VARCHAR(20) NOT NULL,
          \`start_date\` DATE NULL,
          \`end_date\` DATE NULL,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`is_current\` TINYINT(1) NOT NULL DEFAULT 0,
          \`created_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`uq_academic_sessions_code\`(\`session_code\`),
          INDEX \`IDX_ACADEMIC_SESSIONS_ACTIVE\`(\`is_active\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`class_or_depts\` (
          \`id\` CHAR(36) NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`code\` VARCHAR(20) NOT NULL,
          \`level\` VARCHAR(20) NOT NULL DEFAULT 'SCHOOL',
          \`display_order\` INT NOT NULL DEFAULT 1,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`uq_class_or_depts_code\`(\`code\`),
          INDEX \`IDX_CLASS_OR_DEPTS_ACTIVE\`(\`is_active\`),
          INDEX \`IDX_CLASS_OR_DEPTS_LEVEL\`(\`level\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`exam_term_types\` (
          \`id\` CHAR(36) NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`code\` VARCHAR(30) NOT NULL,
          \`engine_behavior\` VARCHAR(30) NOT NULL DEFAULT 'TERMINAL',
          \`description\` VARCHAR(255) NULL,
          \`display_order\` INT NOT NULL DEFAULT 1,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`uq_exam_term_types_code\`(\`code\`),
          INDEX \`IDX_EXAM_TERM_TYPES_ACTIVE\`(\`is_active\`),
          INDEX \`IDX_EXAM_TERM_TYPES_BEHAVIOR\`(\`engine_behavior\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`academic_subjects\` (
          \`id\` CHAR(36) NOT NULL,
          \`subject_code\` VARCHAR(30) NOT NULL,
          \`subject_name\` VARCHAR(150) NOT NULL,
          \`board_stream\` VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
          \`paper_number\` INT NULL,
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_SUBJECTS_CODE\`(\`subject_code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed common Bangladesh master subjects if empty
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

      // Seed standard term types if none exist
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO \`exam_term_types\` (\`id\`, \`name\`, \`code\`, \`engine_behavior\`, \`description\`, \`display_order\`, \`is_active\`)
        SELECT UUID(), name, code, behavior, descr, ord, 1 FROM (
          SELECT 'Class Test / Incourse' AS name, 'SUB_EXAM_CT' AS code, 'SUB_EXAM_CT' AS behavior, 'Child sub-exam aggregated into its parent terminal (CC-06)' AS descr, 1 AS ord UNION ALL
          SELECT 'Terminal Exam', 'TERMINAL', 'TERMINAL', 'Main exam term — generates marksheets directly', 2 UNION ALL
          SELECT 'Annual (Cumulative)', 'CUMULATIVE_ANNUAL', 'CUMULATIVE_ANNUAL', 'Weighted aggregate of terminal children (CC-11 / AD-7)', 3 UNION ALL
          SELECT 'Half-Yearly', 'HALF_YEARLY', 'TERMINAL', 'Mid-year terminal exam', 4 UNION ALL
          SELECT 'Yearly Final', 'YEARLY_FINAL', 'TERMINAL', 'Year-end terminal exam', 5 UNION ALL
          SELECT 'Model Test', 'MODEL_TEST', 'TERMINAL', 'Pre-board model test (terminal behavior)', 6 UNION ALL
          SELECT 'Monthly Class Test', 'MONTHLY_CT', 'SUB_EXAM_CT', 'Monthly CT aggregated into the terminal', 7
        ) seed
        WHERE NOT EXISTS (SELECT 1 FROM \`exam_term_types\` t WHERE t.\`code\` = seed.\`code\`);
      `);

      this.tablesEnsured = true;
    } catch (error) {
      this.logger.error('Failed to ensure master tables:', error);
    }
  }

  /* ================= sessions ================= */

  async listSessions(includeInactive = false) {
    await this.ensureTables();
    try {
      return await this.prisma.academicSessions.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ isCurrent: 'desc' }, { sessionCode: 'desc' }],
      });
    } catch (err) {
      this.logger.error('listSessions query error:', err);
      return [];
    }
  }

  async createSession(dto: CreateAcademicSessionDto) {
    await this.ensureTables();
    await this.assertSessionCodeFree(dto.sessionCode);
    const id = randomUUID();
    const created = await this.prisma.academicSessions.create({
      data: {
        id,
        sessionName: dto.sessionName.trim(),
        sessionCode: dto.sessionCode.trim(),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: dto.isActive ?? true,
        isCurrent: dto.isCurrent ?? false,
      },
    });
    if (created.isCurrent) await this.markOnlyCurrent(created.id);
    return this.getSession(created.id);
  }

  async updateSession(id: string, dto: UpdateAcademicSessionDto) {
    await this.ensureTables();
    const existing = await this.getSession(id);
    if (dto.sessionCode && dto.sessionCode.trim() !== existing.sessionCode) {
      await this.assertSessionCodeFree(dto.sessionCode);
    }
    const updated = await this.prisma.academicSessions.update({
      where: { id },
      data: {
        sessionName: dto.sessionName?.trim() ?? undefined,
        sessionCode: dto.sessionCode?.trim() ?? undefined,
        startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
        isActive: dto.isActive ?? undefined,
        isCurrent: dto.isCurrent ?? undefined,
      },
    });
    if (updated.isCurrent) await this.markOnlyCurrent(updated.id);
    return this.getSession(updated.id);
  }

  async deleteSession(id: string) {
    await this.ensureTables();
    await this.getSession(id);
    const usage = await this.countScopeUsage({ academicSessionId: id });
    if (usage > 0) {
      throw new BadRequestException(`Session is referenced by ${usage} record(s) — deactivate it instead of deleting`);
    }
    await this.prisma.academicSessions.delete({ where: { id } });
    return { deleted: true as const };
  }

  private async getSession(id: string) {
    const row = await this.prisma.academicSessions.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Academic session #${id} not found`);
    return row;
  }

  private async assertSessionCodeFree(code: string) {
    const clash = await this.prisma.academicSessions.findUnique({ where: { sessionCode: code.trim() } });
    if (clash) throw new BadRequestException(`Session code "${code.trim()}" already exists`);
  }

  /** Only one session is current at a time — setting one clears the rest. */
  private async markOnlyCurrent(id: string) {
    await this.prisma.academicSessions.updateMany({ where: { id: { not: id }, isCurrent: true }, data: { isCurrent: false } });
  }

  /* ================= classes / departments ================= */

  async listClasses(includeInactive = false, level?: string) {
    await this.ensureTables();
    if (level && !(CLASS_LEVELS as readonly string[]).includes(level)) {
      throw new BadRequestException(`Unknown level "${level}"`);
    }
    try {
      return await this.prisma.classOrDepts.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(level ? { level } : {}),
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      });
    } catch (err) {
      this.logger.error('listClasses query error:', err);
      return [];
    }
  }

  async createClass(dto: CreateClassOrDeptDto) {
    await this.ensureTables();
    await this.assertClassCodeFree(dto.code);
    return this.prisma.classOrDepts.create({
      data: {
        id: randomUUID(),
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        level: dto.level ?? 'SCHOOL',
        displayOrder: dto.displayOrder ?? 1,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateClass(id: string, dto: UpdateClassOrDeptDto) {
    await this.ensureTables();
    const existing = await this.getClass(id);
    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      await this.assertClassCodeFree(dto.code);
    }
    if (dto.level && !(CLASS_LEVELS as readonly string[]).includes(dto.level)) {
      throw new BadRequestException(`Unknown level "${dto.level}"`);
    }
    return this.prisma.classOrDepts.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        code: dto.code?.trim().toUpperCase() ?? undefined,
        level: dto.level ?? undefined,
        displayOrder: dto.displayOrder ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async deleteClass(id: string) {
    await this.ensureTables();
    await this.getClass(id);
    const usage = await this.countScopeUsage({ classOrDeptId: id });
    if (usage > 0) {
      throw new BadRequestException(`Class is referenced by ${usage} record(s) — deactivate it instead of deleting`);
    }
    await this.prisma.classOrDepts.delete({ where: { id } });
    return { deleted: true as const };
  }

  private async getClass(id: string) {
    const row = await this.prisma.classOrDepts.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Class/department #${id} not found`);
    return row;
  }

  private async assertClassCodeFree(code: string) {
    const clash = await this.prisma.classOrDepts.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (clash) throw new BadRequestException(`Class code "${code.trim().toUpperCase()}" already exists`);
  }

  /* ================= exam term types (dynamic) ================= */

  async listTermTypes(includeInactive = false) {
    await this.ensureTables();
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, code, engine_behavior AS engineBehavior, description, display_order AS displayOrder, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
         FROM \`exam_term_types\`
         ${includeInactive ? '' : 'WHERE is_active = 1'}
         ORDER BY display_order ASC, name ASC`
      );
      return (rows || []).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        code: String(r.code),
        engineBehavior: String(r.engineBehavior),
        description: r.description ? String(r.description) : null,
        displayOrder: Number(r.displayOrder ?? 1),
        isActive: Boolean(Number(r.isActive)),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch (err) {
      this.logger.error('listTermTypes query error:', err);
      return [];
    }
  }

  async createTermType(dto: CreateExamTermTypeDto) {
    await this.ensureTables();
    await this.assertTermTypeCodeFree(dto.code);
    const id = randomUUID();
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    const engineBehavior = dto.engineBehavior;
    const description = dto.description?.trim() || null;
    const displayOrder = dto.displayOrder ?? 1;
    const isActive = dto.isActive ?? true;

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO \`exam_term_types\` (\`id\`, \`name\`, \`code\`, \`engine_behavior\`, \`description\`, \`display_order\`, \`is_active\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      name,
      code,
      engineBehavior,
      description,
      displayOrder,
      isActive ? 1 : 0,
    );

    return this.getTermType(id);
  }

  async updateTermType(id: string, dto: UpdateExamTermTypeDto) {
    await this.ensureTables();
    const existing = await this.getTermType(id);
    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      await this.assertTermTypeCodeFree(dto.code);
    }

    const name = dto.name?.trim() ?? existing.name;
    const code = dto.code?.trim().toUpperCase() ?? existing.code;
    const engineBehavior = dto.engineBehavior ?? existing.engineBehavior;
    const description = dto.description === undefined ? existing.description : dto.description?.trim() || null;
    const displayOrder = dto.displayOrder ?? existing.displayOrder;
    const isActive = dto.isActive === undefined ? existing.isActive : dto.isActive;

    await this.prisma.$executeRawUnsafe(
      `UPDATE \`exam_term_types\`
       SET \`name\` = ?, \`code\` = ?, \`engine_behavior\` = ?, \`description\` = ?, \`display_order\` = ?, \`is_active\` = ?
       WHERE \`id\` = ?`,
      name,
      code,
      engineBehavior,
      description,
      displayOrder,
      isActive ? 1 : 0,
      id,
    );

    return this.getTermType(id);
  }

  async deleteTermType(id: string) {
    await this.ensureTables();
    const existing = await this.getTermType(id);
    if ((ENGINE_BEHAVIORS as readonly string[]).includes(existing.code)) {
      throw new BadRequestException(`"${existing.code}" is a built-in engine behavior and cannot be deleted — deactivate it instead`);
    }
    const used = await this.prisma.examTerms.count({ where: { termType: existing.code } });
    if (used > 0) {
      throw new BadRequestException(`Term type is used by ${used} exam term(s) — deactivate it instead of deleting`);
    }
    await this.prisma.$executeRawUnsafe(`DELETE FROM \`exam_term_types\` WHERE \`id\` = ?`, id);
    return { deleted: true as const };
  }

  private async getTermType(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, code, engine_behavior AS engineBehavior, description, display_order AS displayOrder, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
       FROM \`exam_term_types\` WHERE \`id\` = ? LIMIT 1`,
      id,
    );
    if (!rows || !rows.length) throw new NotFoundException(`Exam term type #${id} not found`);
    const r = rows[0];
    return {
      id: String(r.id),
      name: String(r.name),
      code: String(r.code),
      engineBehavior: String(r.engineBehavior),
      description: r.description ? String(r.description) : null,
      displayOrder: Number(r.displayOrder ?? 1),
      isActive: Boolean(Number(r.isActive)),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private async assertTermTypeCodeFree(code: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM \`exam_term_types\` WHERE \`code\` = ? LIMIT 1`,
      code.trim().toUpperCase(),
    );
    if (rows && rows.length) throw new BadRequestException(`Term type code "${code.trim().toUpperCase()}" already exists`);
  }

  /* ================= usage guard ================= */

  private async countScopeUsage(scope: { academicSessionId?: string; classOrDeptId?: string }) {
    const where = { ...scope };
    const [syllabus, terms, enrollments, campaigns] = await Promise.all([
      this.prisma.classSyllabusSubjects.count({ where }),
      this.prisma.examTerms.count({ where }),
      this.prisma.studentEnrollments.count({ where }),
      scope.academicSessionId && !scope.classOrDeptId
        ? this.prisma.admissionCampaigns.count({ where: { academicSessionId: scope.academicSessionId } })
        : Promise.resolve(0),
    ]);
    return syllabus + terms + enrollments + campaigns;
  }
}
