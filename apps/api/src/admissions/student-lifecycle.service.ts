import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { toDateOnly, toDateValue } from '../prisma/wire';
import { RollNumberGeneratorService } from './common/roll-number-generator.service';

export interface StudentListFilters {
  academicSessionId?: string;
  classOrDeptId?: string;
  sectionOrBatchId?: string;
  academicGroup?: string;
  quotaTag?: string;
  residenceType?: string;
  status?: string;
  feeDue?: boolean;
  search?: string;
  limit?: number;
}

export interface StudentClearance {
  studentId: string;
  studentUniqueId: string;
  currentStatus: string;
  arBalance: string;
  cautionHeld: string;
  canIssueTc: boolean;
  blockers: string[];
}

/**
 * Phase 5 — Student Directory, Promotion, Section Transfer & TC workflow
 * (docs/STUDENT_ADMISSION_PLAN.md Phase 5).
 *
 * Directory: session/class/section/group/quota/residence/fee-due filters.
 * TC issue: hard gate on Accounting — student AR balance must be 0.00 and
 * Library/Lab caution deposits settled (status ≠ HELD) before status flips
 * to TC_ISSUED. An explicit override reason can waive dues (audited on the
 * student row). Promotion/readmission create a fresh session enrollment and
 * retire the previous active one; section transfer re-rolls in the new scope.
 */
@Injectable()
export class StudentLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolls: RollNumberGeneratorService,
  ) {}

  /* ================= directory ================= */

  async listStudents(filters: StudentListFilters) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);

    // Resolve enrollment-scoped filters to a student-id set first.
    let idsFromEnroll: string[] | null = null;
    if (
      filters.academicSessionId ||
      filters.classOrDeptId ||
      filters.sectionOrBatchId ||
      filters.academicGroup ||
      filters.quotaTag ||
      filters.residenceType
    ) {
      const eqb: Prisma.StudentEnrollmentsWhereInput = { isActive: true };
      if (filters.academicSessionId) eqb.academicSessionId = filters.academicSessionId;
      if (filters.classOrDeptId) eqb.classOrDeptId = filters.classOrDeptId;
      if (filters.sectionOrBatchId) eqb.sectionOrBatchId = filters.sectionOrBatchId;
      if (filters.academicGroup) eqb.academicGroup = filters.academicGroup;
      if (filters.quotaTag) eqb.quotaTag = filters.quotaTag;
      if (filters.residenceType) eqb.residenceType = filters.residenceType;
      const raw = await this.prisma.studentEnrollments.findMany({
        where: eqb,
        select: { studentId: true },
        distinct: ['studentId'],
      });
      idsFromEnroll = raw.map((r) => r.studentId);
      if (idsFromEnroll.length === 0) return [];
    }

    const where: Prisma.StudentsWhereInput = {};
    if (idsFromEnroll) where.id = { in: idsFromEnroll };
    if (filters.status) where.currentStatus = filters.status;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { fullNameEn: { contains: q } },
        { fullNameBn: { contains: q } },
        { studentUniqueId: { contains: q } },
        { birthRegNo: { contains: q } },
      ];
    }
    // fee-due is computed from invoices after the fetch, so scan a wider
    // window and slice to `limit` once the filter is applied.
    const students = await this.prisma.students.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.feeDue ? 1000 : limit,
    });
    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);
    const [enrollments, balances] = await Promise.all([
      this.prisma.studentEnrollments.findMany({
        where: { studentId: { in: studentIds }, isActive: true },
      }),
      this.bulkBalances(studentIds),
    ]);

    let rows = students.map((s) => {
      const en = enrollments.find((e) => e.studentId === s.id) ?? null;
      const arBalance = balances.get(s.id) ?? '0.00';
      return {
        id: s.id,
        studentUniqueId: s.studentUniqueId,
        fullNameEn: s.fullNameEn,
        fullNameBn: s.fullNameBn ?? null,
        gender: s.gender,
        currentStatus: s.currentStatus,
        admissionDate: toDateOnly(s.admissionDate),
        photoUrl: s.photoUrl ?? null,
        arBalance,
        feeDue: new Decimal(arBalance).gt(0),
        enrollment: en
          ? {
              id: en.id,
              academicSessionId: en.academicSessionId,
              institutionType: en.institutionType,
              classOrDeptId: en.classOrDeptId,
              sectionOrBatchId: en.sectionOrBatchId ?? null,
              academicGroup: en.academicGroup,
              classRollNo: en.classRollNo,
              residenceType: en.residenceType,
              quotaTag: en.quotaTag,
              enrollmentType: en.enrollmentType,
            }
          : null,
      };
    });
    if (filters.feeDue) rows = rows.filter((r) => r.feeDue);
    return rows.slice(0, limit);
  }

  /**
   * Distinct session / class / section ids present in active enrollments —
   * feeds the directory filter dropdowns so officers pick real values
   * instead of typing raw UUIDs (no Academic Core master yet).
   */
  async filterOptions() {
    const distinct = async (column: 'academicSessionId' | 'classOrDeptId' | 'sectionOrBatchId') => {
      const where: Prisma.StudentEnrollmentsWhereInput = { isActive: true };
      if (column === 'sectionOrBatchId') where.sectionOrBatchId = { not: null };
      const raw = await this.prisma.studentEnrollments.groupBy({
        by: [column],
        where,
        _count: { _all: true },
      });
      return raw
        .filter((r) => r[column] != null)
        .map((r) => ({
          value: r[column] as string,
          label: `${r[column]} (${r._count._all})`,
          count: r._count._all,
        }))
        .sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
    };
    const [sessions, classes, sections] = await Promise.all([
      distinct('academicSessionId'),
      distinct('classOrDeptId'),
      distinct('sectionOrBatchId'),
    ]);
    return { sessions, classes, sections };
  }

  async getProfile(studentId: string) {
    const student = await this.prisma.students.findUnique({
      where: { id: studentId },
      include: { familyProfiles: true },
    });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);
    const [enrollments, previousEducations, documents, balances] = await Promise.all([
      this.prisma.studentEnrollments.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentPreviousEducations.findMany({ where: { studentId } }),
      this.prisma.studentDocuments.findMany({ where: { studentId } }),
      this.bulkBalances([studentId]),
    ]);
    const { familyProfiles, ...studentRest } = student;
    return {
      student: { ...studentRest, familyProfile: familyProfiles ?? null },
      family: familyProfiles ?? null,
      enrollments,
      previousEducations,
      documents,
      arBalance: balances.get(studentId) ?? '0.00',
    };
  }

  /* ================= TC clearance + issue ================= */

  async clearance(studentId: string, tx?: Prisma.TransactionClient): Promise<StudentClearance> {
    const db = tx ?? this.prisma;
    const student = await db.students.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);

    const balances = await this.bulkBalances([studentId], tx);
    const arBalance = balances.get(studentId) ?? '0.00';
    const cautionHeld = await this.cautionHeld(studentId, tx);

    const blockers: string[] = [];
    if (new Decimal(arBalance).gt(0)) blockers.push(`Outstanding student AR balance ${arBalance} BDT`);
    if (new Decimal(cautionHeld).gt(0)) {
      blockers.push(`Library/Lab caution deposit ${cautionHeld} BDT still held — settle or refund first`);
    }
    if (student.currentStatus === 'TC_ISSUED') blockers.push('Transfer Certificate already issued');

    return {
      studentId,
      studentUniqueId: student.studentUniqueId,
      currentStatus: student.currentStatus,
      arBalance,
      cautionHeld,
      canIssueTc: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Issue a TC. Blocked while AR balance > 0 or caution deposits are HELD
   * (plan Phase 5 acceptance). `overrideReason` explicitly waives dues and
   * is recorded on the student for audit.
   */
  async issueTc(
    studentId: string,
    dto: { tcNumber?: string; issueDate?: string; remark?: string; overrideReason?: string },
    _actorId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const clear = await this.clearance(studentId, tx);
        const override = (dto.overrideReason ?? '').trim();
        if (clear.blockers.length > 0 && !override) {
          throw new BadRequestException(
            `TC blocked for ${clear.studentUniqueId}: ${clear.blockers.join('; ')}. Clear dues or pass overrideReason to waive.`,
          );
        }
        if (override && override.length < 3) {
          throw new BadRequestException('overrideReason must be at least 3 characters');
        }
        const student = await tx.students.findUnique({ where: { id: studentId } });
        if (!student) throw new NotFoundException(`Student #${studentId} not found`);

        const tcNumber = (dto.tcNumber ?? '').trim() || student.tcNumber || `TC-${student.studentUniqueId}`;
        const tcIssueDate = toDateValue((dto.issueDate ?? new Date().toISOString()).slice(0, 10));
        const tcRemark =
          (dto.remark ?? '').trim() ||
          (clear.blockers.length > 0 ? `Dues waived: ${override}` : 'Dues clear at issue');
        await tx.students.update({
          where: { id: studentId },
          data: { currentStatus: 'TC_ISSUED', tcNumber, tcIssueDate, tcRemark },
        });
        await tx.studentEnrollments.updateMany({
          where: { studentId, isActive: true },
          data: { isActive: false },
        });

        return {
          studentId,
          studentUniqueId: student.studentUniqueId,
          status: 'TC_ISSUED',
          tcNumber,
          tcIssueDate: toDateOnly(tcIssueDate),
          arBalance: clear.arBalance,
          cautionHeld: clear.cautionHeld,
          duesWaived: clear.blockers.length > 0,
          overrideReason: override || null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ================= promotion / readmission / section transfer ================= */

  async promote(dto: {
    studentIds: string[];
    targetSessionId: string;
    targetClassOrDeptId: string;
    sectionOrBatchId?: string | null;
    academicGroup?: string | null;
    institutionType?: string;
    enrollmentType?: string;
  }) {
    const type = (dto.enrollmentType ?? 'PROMOTED').trim().toUpperCase();
    if (!['PROMOTED', 'READMISSION'].includes(type)) {
      throw new BadRequestException('enrollmentType must be PROMOTED or READMISSION');
    }
    if (!dto.studentIds?.length) throw new BadRequestException('Select at least one student');

    return this.prisma.$transaction(
      async (tx) => {
        const rows: Array<{ studentId: string; studentUniqueId: string; enrollmentId: string; classRollNo: number }> = [];
        const skipped: Array<{ studentId: string; reason: string }> = [];

        for (const studentId of Array.from(new Set(dto.studentIds))) {
          try {
            const student = await tx.students.findUnique({ where: { id: studentId } });
            if (!student) throw new Error('Student not found');
            if (student.currentStatus !== 'ACTIVE') throw new Error(`Status is ${student.currentStatus}`);
            const current = await tx.studentEnrollments.findFirst({
              where: { studentId, isActive: true },
            });
            const roll = await this.rolls.nextRoll(
              tx,
              dto.targetSessionId,
              dto.targetClassOrDeptId,
              dto.sectionOrBatchId ?? null,
            );
            if (current) {
              await tx.studentEnrollments.update({
                where: { id: current.id },
                data: { isActive: false },
              });
            }
            const saved = await tx.studentEnrollments.create({
              data: {
                studentId,
                academicSessionId: dto.targetSessionId,
                institutionType: (dto.institutionType ?? current?.institutionType ?? 'SCHOOL').trim().toUpperCase(),
                classOrDeptId: dto.targetClassOrDeptId,
                shiftId: current?.shiftId ?? null,
                sectionOrBatchId: dto.sectionOrBatchId ?? null,
                academicGroup: (dto.academicGroup ?? current?.academicGroup ?? 'GENERAL').trim().toUpperCase(),
                classRollNo: roll,
                enrollmentType: type,
                residenceType: current?.residenceType ?? 'DAY_SCHOLAR',
                quotaTag: current?.quotaTag ?? 'NONE',
                isActive: true,
              },
            });
            rows.push({
              studentId,
              studentUniqueId: student.studentUniqueId,
              enrollmentId: saved.id,
              classRollNo: saved.classRollNo,
            });
          } catch (e) {
            skipped.push({ studentId, reason: e instanceof Error ? e.message : 'Failed' });
          }
        }
        return { enrollmentType: type, promoted: rows.length, skipped, rows };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async peekRoll(dto: {
    academicSessionId: string;
    classOrDeptId: string;
    sectionOrBatchId?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const roll = await this.rolls.peekRoll(tx, dto.academicSessionId, dto.classOrDeptId, dto.sectionOrBatchId ?? null);
      return { classRollNo: roll };
    });
  }

  async transferSection(
    studentId: string,
    dto: {
      academicSessionId?: string;
      sectionOrBatchId?: string | null;
      shiftId?: string | null;
      academicGroup?: string | null;
      residenceType?: string | null;
      quotaTag?: string | null;
    },
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const student = await tx.students.findUnique({ where: { id: studentId } });
        if (!student) throw new NotFoundException(`Student #${studentId} not found`);
        const en = await tx.studentEnrollments.findFirst({
          where: { studentId, isActive: true },
        });
        if (!en) throw new BadRequestException('No active enrollment to transfer');

        const targetSession = dto.academicSessionId ?? en.academicSessionId;
        const targetSection = dto.sectionOrBatchId !== undefined ? dto.sectionOrBatchId : en.sectionOrBatchId;
        const roll = await this.rolls.nextRoll(tx, targetSession, en.classOrDeptId, targetSection ?? null);

        const data: Prisma.StudentEnrollmentsUpdateInput = {
          academicSessionId: targetSession,
          sectionOrBatchId: targetSection ?? null,
          classRollNo: roll,
        };
        if (dto.shiftId !== undefined) data.shiftId = dto.shiftId;
        if (dto.academicGroup !== undefined) data.academicGroup = (dto.academicGroup ?? 'GENERAL').trim().toUpperCase();
        if (dto.residenceType !== undefined) data.residenceType = dto.residenceType;
        if (dto.quotaTag !== undefined) data.quotaTag = dto.quotaTag;
        try {
          await tx.studentEnrollments.update({ where: { id: en.id }, data });
        } catch (e) {
          throw new BadRequestException(
            `Section transfer collision — retry (${e instanceof Error ? e.message : e})`,
          );
        }
        return {
          studentId,
          studentUniqueId: student.studentUniqueId,
          enrollmentId: en.id,
          academicSessionId: targetSession,
          sectionOrBatchId: targetSection ?? null,
          classRollNo: roll,
          residenceType: data.residenceType ?? en.residenceType,
          quotaTag: data.quotaTag ?? en.quotaTag,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ================= internals ================= */

  /** Outstanding AR per student = Σ(net + fine − paid) over non-reversed invoices, floored at 0. */
  private async bulkBalances(
    studentIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (studentIds.length === 0) return map;
    const db = tx ?? this.prisma;
    const raw = await db.$queryRaw<{ sid: string; bal: string | number | null }[]>(Prisma.sql`
      SELECT inv.student_id AS sid,
             SUM(inv.net_amount + inv.late_fine_amount - inv.paid_amount) AS bal
      FROM student_invoices inv
      WHERE inv.student_id IN (${Prisma.join(studentIds)})
        AND inv.status <> ${'REVERSED'}
      GROUP BY inv.student_id
    `);
    for (const r of raw) {
      const bal = new Decimal(String(r.bal ?? 0));
      map.set(r.sid, (bal.gt(0) ? bal : new Decimal(0)).toFixed(2));
    }
    return map;
  }

  private async cautionHeld(studentId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx ?? this.prisma;
    const raw = await db.$queryRaw<{ amt: string | number | null }[]>(Prisma.sql`
      SELECT SUM(c.amount) AS amt
      FROM student_caution_deposits c
      WHERE c.student_id = ${studentId}
        AND c.status = ${'HELD'}
    `);
    return new Decimal(String(raw[0]?.amt ?? 0)).toFixed(2);
  }
}
