import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Student } from '../database/entities/student.entity';
import { StudentEnrollment } from '../database/entities/student-enrollment.entity';
import { StudentPreviousEducation } from '../database/entities/student-previous-education.entity';
import { StudentDocument } from '../database/entities/student-document.entity';
import { StudentInvoice } from '../database/entities/student-invoice.entity';
import { StudentCautionDeposit } from '../database/entities/student-caution-deposit.entity';
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
    private readonly dataSource: DataSource,
    private readonly rolls: RollNumberGeneratorService,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(StudentEnrollment) private readonly enrollments: Repository<StudentEnrollment>,
    @InjectRepository(StudentPreviousEducation) private readonly prevEdus: Repository<StudentPreviousEducation>,
    @InjectRepository(StudentDocument) private readonly documents: Repository<StudentDocument>,
    @InjectRepository(StudentInvoice) private readonly invoices: Repository<StudentInvoice>,
    @InjectRepository(StudentCautionDeposit) private readonly cautions: Repository<StudentCautionDeposit>,
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
      const eqb = this.enrollments
        .createQueryBuilder('e')
        .select('DISTINCT e.studentId', 'sid')
        .where('e.isActive = :active', { active: true });
      if (filters.academicSessionId) eqb.andWhere('e.academicSessionId = :as', { as: filters.academicSessionId });
      if (filters.classOrDeptId) eqb.andWhere('e.classOrDeptId = :cd', { cd: filters.classOrDeptId });
      if (filters.sectionOrBatchId) eqb.andWhere('e.sectionOrBatchId = :sb', { sb: filters.sectionOrBatchId });
      if (filters.academicGroup) eqb.andWhere('e.academicGroup = :ag', { ag: filters.academicGroup });
      if (filters.quotaTag) eqb.andWhere('e.quotaTag = :qt', { qt: filters.quotaTag });
      if (filters.residenceType) eqb.andWhere('e.residenceType = :rt', { rt: filters.residenceType });
      const raw = await eqb.getRawMany<{ sid: string }>();
      idsFromEnroll = raw.map((r) => r.sid);
      if (idsFromEnroll.length === 0) return [];
    }

    const qb = this.students
      .createQueryBuilder('s')
      .orderBy('s.createdAt', 'DESC')
      // fee-due is computed from invoices after the fetch, so scan a wider
      // window and slice to `limit` once the filter is applied.
      .take(filters.feeDue ? 1000 : limit);
    if (idsFromEnroll) qb.andWhere('s.id IN (:...ids)', { ids: idsFromEnroll });
    if (filters.status) qb.andWhere('s.currentStatus = :st', { st: filters.status });
    if (filters.search?.trim()) {
      qb.andWhere(
        '(s.fullNameEn LIKE :q OR s.fullNameBn LIKE :q OR s.studentUniqueId LIKE :q OR s.birthRegNo LIKE :q)',
        { q: `%${filters.search.trim()}%` },
      );
    }
    const students = await qb.getMany();
    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);
    const [enrollments, balances] = await Promise.all([
      this.enrollments.find({ where: { studentId: In(studentIds), isActive: true } }),
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
        admissionDate: s.admissionDate,
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
      const qb = this.enrollments
        .createQueryBuilder('e')
        .select(`e.${column}`, 'v')
        .addSelect('COUNT(*)', 'c')
        .where('e.isActive = :active', { active: true });
      if (column === 'sectionOrBatchId') qb.andWhere('e.sectionOrBatchId IS NOT NULL');
      const raw = await qb.groupBy(`e.${column}`).orderBy(`e.${column}`, 'ASC').getRawMany<{ v: string; c: string }>();
      return raw
        .filter((r) => r.v != null)
        .map((r) => ({ value: r.v, label: `${r.v} (${r.c})`, count: Number(r.c) }));
    };
    const [sessions, classes, sections] = await Promise.all([
      distinct('academicSessionId'),
      distinct('classOrDeptId'),
      distinct('sectionOrBatchId'),
    ]);
    return { sessions, classes, sections };
  }

  async getProfile(studentId: string) {
    const student = await this.students.findOne({ where: { id: studentId }, relations: ['familyProfile'] });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);
    const [enrollments, previousEducations, documents, balances] = await Promise.all([
      this.enrollments.find({ where: { studentId }, order: { createdAt: 'DESC' } }),
      this.prevEdus.find({ where: { studentId } }),
      this.documents.find({ where: { studentId } }),
      this.bulkBalances([studentId]),
    ]);
    return {
      student,
      family: student.familyProfile ?? null,
      enrollments,
      previousEducations,
      documents,
      arBalance: balances.get(studentId) ?? '0.00',
    };
  }

  /* ================= TC clearance + issue ================= */

  async clearance(studentId: string, manager?: EntityManager): Promise<StudentClearance> {
    const repo = manager?.getRepository(Student) ?? this.students;
    const student = await repo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);

    const balances = await this.bulkBalances([studentId], manager);
    const arBalance = balances.get(studentId) ?? '0.00';
    const cautionHeld = await this.cautionHeld(studentId, manager);

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
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const clear = await this.clearance(studentId, m);
      const override = (dto.overrideReason ?? '').trim();
      if (clear.blockers.length > 0 && !override) {
        throw new BadRequestException(
          `TC blocked for ${clear.studentUniqueId}: ${clear.blockers.join('; ')}. Clear dues or pass overrideReason to waive.`,
        );
      }
      if (override && override.length < 3) {
        throw new BadRequestException('overrideReason must be at least 3 characters');
      }
      const student = await m.getRepository(Student).findOne({ where: { id: studentId } });
      if (!student) throw new NotFoundException(`Student #${studentId} not found`);

      student.currentStatus = 'TC_ISSUED';
      student.tcNumber = (dto.tcNumber ?? '').trim() || student.tcNumber || `TC-${student.studentUniqueId}`;
      student.tcIssueDate = (dto.issueDate ?? new Date().toISOString()).slice(0, 10);
      student.tcRemark =
        (dto.remark ?? '').trim() ||
        (clear.blockers.length > 0 ? `Dues waived: ${override}` : 'Dues clear at issue');
      await m.getRepository(Student).save(student);
      await m.getRepository(StudentEnrollment).update({ studentId, isActive: true }, { isActive: false });

      return {
        studentId,
        studentUniqueId: student.studentUniqueId,
        status: student.currentStatus,
        tcNumber: student.tcNumber,
        tcIssueDate: student.tcIssueDate,
        arBalance: clear.arBalance,
        cautionHeld: clear.cautionHeld,
        duesWaived: clear.blockers.length > 0,
        overrideReason: override || null,
      };
    });
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

    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const studentsRepo = m.getRepository(Student);
      const enrollRepo = m.getRepository(StudentEnrollment);
      const rows: Array<{ studentId: string; studentUniqueId: string; enrollmentId: string; classRollNo: number }> = [];
      const skipped: Array<{ studentId: string; reason: string }> = [];

      for (const studentId of Array.from(new Set(dto.studentIds))) {
        try {
          const student = await studentsRepo.findOne({ where: { id: studentId } });
          if (!student) throw new Error('Student not found');
          if (student.currentStatus !== 'ACTIVE') throw new Error(`Status is ${student.currentStatus}`);
          const current = await enrollRepo.findOne({ where: { studentId, isActive: true } });
          const roll = await this.rolls.nextRoll(
            m,
            dto.targetSessionId,
            dto.targetClassOrDeptId,
            dto.sectionOrBatchId ?? null,
          );
          if (current) {
            current.isActive = false;
            await enrollRepo.save(current);
          }
          const saved = await enrollRepo.save(
            enrollRepo.create({
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
            }),
          );
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
    });
  }

  async transferSection(
    studentId: string,
    dto: { academicSessionId?: string; sectionOrBatchId?: string | null; shiftId?: string | null; academicGroup?: string | null },
  ) {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const student = await m.getRepository(Student).findOne({ where: { id: studentId } });
      if (!student) throw new NotFoundException(`Student #${studentId} not found`);
      const repo = m.getRepository(StudentEnrollment);
      const en = await repo.findOne({ where: { studentId, isActive: true } });
      if (!en) throw new BadRequestException('No active enrollment to transfer');

      const targetSession = dto.academicSessionId ?? en.academicSessionId;
      const targetSection = dto.sectionOrBatchId !== undefined ? dto.sectionOrBatchId : en.sectionOrBatchId;
      const roll = await this.rolls.nextRoll(m, targetSession, en.classOrDeptId, targetSection ?? null);

      en.academicSessionId = targetSession;
      en.sectionOrBatchId = targetSection ?? null;
      if (dto.shiftId !== undefined) en.shiftId = dto.shiftId;
      if (dto.academicGroup !== undefined) en.academicGroup = (dto.academicGroup ?? 'GENERAL').trim().toUpperCase();
      en.classRollNo = roll;
      try {
        await repo.save(en);
      } catch (e) {
        throw new BadRequestException(
          `Section transfer collision — retry (${e instanceof Error ? e.message : e})`,
        );
      }
      return {
        studentId,
        studentUniqueId: student.studentUniqueId,
        enrollmentId: en.id,
        academicSessionId: en.academicSessionId,
        sectionOrBatchId: en.sectionOrBatchId,
        classRollNo: en.classRollNo,
      };
    });
  }

  /* ================= internals ================= */

  /** Outstanding AR per student = Σ(net + fine − paid) over non-reversed invoices, floored at 0. */
  private async bulkBalances(studentIds: string[], manager?: EntityManager): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (studentIds.length === 0) return map;
    const repo = manager?.getRepository(StudentInvoice) ?? this.invoices;
    const raw = await repo
      .createQueryBuilder('inv')
      .select('inv.studentId', 'sid')
      .addSelect('SUM(inv.netAmount + inv.lateFineAmount - inv.paidAmount)', 'bal')
      .where('inv.studentId IN (:...ids)', { ids: studentIds })
      .andWhere('inv.status != :rev', { rev: 'REVERSED' })
      .groupBy('inv.studentId')
      .getRawMany<{ sid: string; bal: string | null }>();
    for (const r of raw) {
      const bal = new Decimal(r.bal ?? 0);
      map.set(r.sid, (bal.gt(0) ? bal : new Decimal(0)).toFixed(2));
    }
    return map;
  }

  private async cautionHeld(studentId: string, manager?: EntityManager): Promise<string> {
    const repo = manager?.getRepository(StudentCautionDeposit) ?? this.cautions;
    const raw = await repo
      .createQueryBuilder('c')
      .select('SUM(c.amount)', 'amt')
      .where('c.studentId = :id', { id: studentId })
      .andWhere('c.status = :held', { held: 'HELD' })
      .getRawOne<{ amt: string | null }>();
    return new Decimal(raw?.amt ?? 0).toFixed(2);
  }
}
