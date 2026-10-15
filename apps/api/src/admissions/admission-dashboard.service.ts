import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { AdmissionCampaign } from '../database/entities/admission-campaign.entity';
import {
  AdmissionApplication,
  ADMISSION_APPLICATION_STATUSES,
} from '../database/entities/admission-application.entity';
import { Student } from '../database/entities/student.entity';
import { StudentEnrollment } from '../database/entities/student-enrollment.entity';
import { StudentInvoice } from '../database/entities/student-invoice.entity';

export interface AdmissionDashboardKpis {
  activeCampaigns: number;
  totalSeats: number;
  totalEnrolled: number;
  seatsRemaining: number;
  fillPct: number;
  totalApplications: number;
  todayAdmissions: number;
  pendingFeeCount: number;
  pendingFeeAmount: string;
}

export interface CampaignSeatRow {
  id: string;
  campaignTitle: string;
  academicSessionId: string;
  classOrDeptId: string;
  totalSeats: number;
  applications: number;
  admitted: number;
  enrolled: number;
  remaining: number;
  fillPct: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

export interface TodayAdmissionRow {
  studentId: string;
  studentUniqueId: string;
  fullNameEn: string;
  gender: string;
  classOrDeptId: string | null;
  sectionOrBatchId: string | null;
  classRollNo: number | null;
  academicGroup: string | null;
}

export interface PendingFeeRow {
  invoiceId: string;
  invoiceNo: string;
  studentId: string;
  studentUniqueId: string;
  fullNameEn: string;
  billingPeriod: string;
  dueDate: string;
  netAmount: string;
  paidAmount: string;
  outstanding: string;
  overdue: boolean;
}

export interface AdmissionDashboardOverview {
  today: string;
  generatedAt: string;
  kpis: AdmissionDashboardKpis;
  applicationStatus: Array<{ status: string; count: number }>;
  campaigns: CampaignSeatRow[];
  todayAdmissions: TodayAdmissionRow[];
  pendingFees: PendingFeeRow[];
}

/**
 * Phase 2/5 — Admission Dashboard (Plan §2 dashboard).
 * Seat capacity vs admitted per campaign, the application funnel, today's
 * admissions feed, and the pending admission-fee list (ADMISSION-* invoices
 * with an outstanding balance).
 */
@Injectable()
export class AdmissionDashboardService {
  constructor(
    @InjectRepository(AdmissionCampaign) private readonly campaigns: Repository<AdmissionCampaign>,
    @InjectRepository(AdmissionApplication) private readonly applications: Repository<AdmissionApplication>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(StudentEnrollment) private readonly enrollments: Repository<StudentEnrollment>,
    @InjectRepository(StudentInvoice) private readonly invoices: Repository<StudentInvoice>,
  ) {}

  async overview(): Promise<AdmissionDashboardOverview> {
    const today = new Date().toISOString().slice(0, 10);

    const campaigns = await this.campaigns.find({ order: { startDate: 'DESC' } });

    const [appRows, enrollRows, statusRows, todayStudents, pendingRows, pendingSum] = await Promise.all([
      // applications grouped by (campaign, status)
      this.applications
        .createQueryBuilder('a')
        .select('a.campaignId', 'campaignId')
        .addSelect('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('a.campaignId')
        .addGroupBy('a.status')
        .getRawMany<{ campaignId: string; status: string; count: string }>(),
      // active enrollments grouped by (session, class) — distinct students
      this.enrollments
        .createQueryBuilder('e')
        .select('e.academicSessionId', 'session')
        .addSelect('e.classOrDeptId', 'classId')
        .addSelect('COUNT(DISTINCT e.studentId)', 'count')
        .where('e.isActive = :active', { active: true })
        .groupBy('e.academicSessionId')
        .addGroupBy('e.classOrDeptId')
        .getRawMany<{ session: string; classId: string; count: string }>(),
      // funnel totals across all campaigns
      this.applications
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('a.status')
        .getRawMany<{ status: string; count: string }>(),
      this.students.find({ where: { admissionDate: today }, order: { createdAt: 'DESC' }, take: 100 }),
      this.pendingBase()
        .select('inv.id', 'invoiceId')
        .addSelect('inv.invoiceNo', 'invoiceNo')
        .addSelect('inv.studentId', 'studentId')
        .addSelect('inv.billingPeriod', 'billingPeriod')
        .addSelect('inv.dueDate', 'dueDate')
        .addSelect('inv.netAmount', 'netAmount')
        .addSelect('inv.paidAmount', 'paidAmount')
        .addSelect('inv.lateFineAmount', 'lateFineAmount')
        .addSelect('(inv.netAmount + inv.lateFineAmount - inv.paidAmount)', 'outstanding')
        .orderBy('inv.dueDate', 'ASC')
        .take(100)
        .getRawMany<{
          invoiceId: string;
          invoiceNo: string;
          studentId: string;
          billingPeriod: string;
          dueDate: string | Date;
          netAmount: string;
          paidAmount: string;
          lateFineAmount: string;
          outstanding: string;
        }>(),
      this.pendingBase()
        .select('COUNT(*)', 'cnt')
        .addSelect('COALESCE(SUM(inv.netAmount + inv.lateFineAmount - inv.paidAmount), 0)', 'amt')
        .getRawOne<{ cnt: string; amt: string }>(),
    ]);

    /* ---------- campaign seat capacity vs admitted ---------- */
    const appsByCampaign = new Map<string, Map<string, number>>();
    for (const r of appRows) {
      const m = appsByCampaign.get(r.campaignId) ?? new Map<string, number>();
      m.set(r.status, Number(r.count));
      appsByCampaign.set(r.campaignId, m);
    }
    const enrolledByScope = new Map<string, number>();
    for (const r of enrollRows) enrolledByScope.set(`${r.session}|${r.classId}`, Number(r.count));

    const campaignRows: CampaignSeatRow[] = campaigns.map((c) => {
      const byStatus = appsByCampaign.get(c.id) ?? new Map<string, number>();
      const applications = Array.from(byStatus.values()).reduce((n, v) => n + v, 0);
      const admitted = byStatus.get('ADMITTED') ?? 0;
      const enrolled = enrolledByScope.get(`${c.academicSessionId}|${c.classOrDeptId}`) ?? 0;
      return {
        id: c.id,
        campaignTitle: c.campaignTitle,
        academicSessionId: c.academicSessionId,
        classOrDeptId: c.classOrDeptId,
        totalSeats: c.totalSeats,
        applications,
        admitted,
        enrolled,
        remaining: Math.max(0, c.totalSeats - enrolled),
        fillPct: pct(enrolled, c.totalSeats),
        isActive: c.isActive,
        startDate: c.startDate,
        endDate: c.endDate,
      };
    });

    /* ---------- KPIs ---------- */
    const activeCampaigns = campaigns.filter((c) => c.isActive);
    const totalSeats = activeCampaigns.reduce((n, c) => n + c.totalSeats, 0);
    // De-duplicate (session, class) so overlapping campaigns aren't double-counted.
    const activeScopes = new Set(activeCampaigns.map((c) => `${c.academicSessionId}|${c.classOrDeptId}`));
    let totalEnrolled = 0;
    activeScopes.forEach((key) => {
      totalEnrolled += enrolledByScope.get(key) ?? 0;
    });

    const statusMap = new Map(statusRows.map((r) => [r.status, Number(r.count)]));
    const applicationStatus = ADMISSION_APPLICATION_STATUSES.map((status) => ({
      status,
      count: statusMap.get(status) ?? 0,
    }));
    const totalApplications = applicationStatus.reduce((n, s) => n + s.count, 0);

    const pendingFeeCount = Number(pendingSum?.cnt ?? 0);
    const pendingFeeAmount = new Decimal(pendingSum?.amt ?? 0).toFixed(2);

    /* ---------- today's admissions (with placement) ---------- */
    const todayIds = todayStudents.map((s) => s.id);
    const todayEnrollments = todayIds.length
      ? await this.enrollments.find({ where: { studentId: In(todayIds), isActive: true } })
      : [];
    const enrollByStudent = new Map(todayEnrollments.map((e) => [e.studentId, e]));
    const todayAdmissions: TodayAdmissionRow[] = todayStudents.map((s) => {
      const en = enrollByStudent.get(s.id);
      return {
        studentId: s.id,
        studentUniqueId: s.studentUniqueId,
        fullNameEn: s.fullNameEn,
        gender: s.gender,
        classOrDeptId: en?.classOrDeptId ?? null,
        sectionOrBatchId: en?.sectionOrBatchId ?? null,
        classRollNo: en?.classRollNo ?? null,
        academicGroup: en?.academicGroup ?? null,
      };
    });

    /* ---------- pending admission fees (with student names) ---------- */
    const pendingStudentIds = Array.from(new Set(pendingRows.map((r) => r.studentId)));
    const pendingStudents = pendingStudentIds.length
      ? await this.students.find({ where: { id: In(pendingStudentIds) } })
      : [];
    const studentById = new Map(pendingStudents.map((s) => [s.id, s]));
    const pendingFees: PendingFeeRow[] = pendingRows.map((r) => {
      const dueDate = toDateOnly(r.dueDate);
      return {
        invoiceId: r.invoiceId,
        invoiceNo: r.invoiceNo,
        studentId: r.studentId,
        studentUniqueId: studentById.get(r.studentId)?.studentUniqueId ?? "—",
        fullNameEn: studentById.get(r.studentId)?.fullNameEn ?? "—",
        billingPeriod: r.billingPeriod,
        dueDate,
        netAmount: new Decimal(r.netAmount ?? 0).toFixed(2),
        paidAmount: new Decimal(r.paidAmount ?? 0).toFixed(2),
        outstanding: new Decimal(r.outstanding ?? 0).toFixed(2),
        overdue: dueDate < today,
      };
    });

    return {
      today,
      generatedAt: new Date().toISOString(),
      kpis: {
        activeCampaigns: activeCampaigns.length,
        totalSeats,
        totalEnrolled,
        seatsRemaining: Math.max(0, totalSeats - totalEnrolled),
        fillPct: pct(totalEnrolled, totalSeats),
        totalApplications,
        todayAdmissions: todayAdmissions.length,
        pendingFeeCount,
        pendingFeeAmount,
      },
      applicationStatus,
      campaigns: campaignRows,
      todayAdmissions,
      pendingFees,
    };
  }

  /** Admission invoices (billing_period = ADMISSION-*) with an outstanding balance. */
  private pendingBase() {
    return this.invoices
      .createQueryBuilder('inv')
      .where("inv.billingPeriod LIKE 'ADMISSION-%'")
      .andWhere('inv.status != :reversed', { reversed: 'REVERSED' })
      .andWhere('(inv.netAmount + inv.lateFineAmount - inv.paidAmount) > 0');
  }
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Normalize a raw DATE (mysql2 returns a Date) to a local YYYY-MM-DD string. */
function toDateOnly(v: string | Date): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}
