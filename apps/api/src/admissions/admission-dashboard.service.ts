import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { ADMISSION_APPLICATION_STATUSES } from '../database/entities/admission-application.entity';

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
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<AdmissionDashboardOverview> {
    const today = new Date().toISOString().slice(0, 10);

    const campaigns = await this.prisma.admissionCampaigns.findMany({
      orderBy: { startDate: 'desc' },
    });

    const [appRows, enrollRows, statusRows, todayStudents, pendingInvoices] =
      await Promise.all([
        // applications grouped by (campaign, status)
        this.prisma.admissionApplications.groupBy({
          by: ['campaignId', 'status'],
          _count: { id: true },
        }),
        // active enrollments grouped by (session, class) — distinct students
        this.prisma.studentEnrollments.groupBy({
          by: ['academicSessionId', 'classOrDeptId'],
          _count: { studentId: true },
          where: { isActive: true },
        }),
        // funnel totals across all campaigns
        this.prisma.admissionApplications.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        this.prisma.students.findMany({
          where: { admissionDate: today },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        // admission invoices with an outstanding balance
        this.prisma.studentInvoices.findMany({
          where: {
            billingPeriod: { startsWith: 'ADMISSION-' },
            status: { not: 'REVERSED' },
          },
          orderBy: { dueDate: 'asc' },
        }),
      ]);

    /* ---------- campaign seat capacity vs admitted ---------- */
    const appsByCampaign = new Map<string, Map<string, number>>();
    for (const r of appRows as Array<{ campaignId: string; status: string; _count: { id: number } }>) {
      const m = appsByCampaign.get(r.campaignId) ?? new Map<string, number>();
      m.set(r.status, r._count.id);
      appsByCampaign.set(r.campaignId, m);
    }
    const enrolledByScope = new Map<string, number>();
    for (const r of enrollRows as Array<{ academicSessionId: string; classOrDeptId: string; _count: { studentId: number } }>) {
      enrolledByScope.set(`${r.academicSessionId}|${r.classOrDeptId}`, r._count.studentId);
    }

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
        startDate: String(c.startDate).slice(0, 10),
        endDate: String(c.endDate).slice(0, 10),
      };
    });

    /* ---------- KPIs ---------- */
    const activeCampaigns = campaigns.filter((c) => c.isActive);
    const totalSeats = activeCampaigns.reduce((n, c) => n + c.totalSeats, 0);
    const activeScopes = new Set(activeCampaigns.map((c) => `${c.academicSessionId}|${c.classOrDeptId}`));
    let totalEnrolled = 0;
    activeScopes.forEach((key) => {
      totalEnrolled += enrolledByScope.get(key) ?? 0;
    });

    const statusMap = new Map((statusRows as Array<{ status: string; _count: { id: number } }>).map((r) => [r.status, r._count.id]));
    const applicationStatus = ADMISSION_APPLICATION_STATUSES.map((status) => ({
      status,
      count: statusMap.get(status) ?? 0,
    }));
    const totalApplications = applicationStatus.reduce((n, s) => n + s.count, 0);

    /* ---------- pending admission fees (outstanding > 0) ---------- */
    const pendingFeesRaw: Array<{
      id: string;
      invoiceNo: string;
      studentId: string;
      billingPeriod: string;
      dueDate: Date | string;
      netAmount: Decimal | number | null;
      lateFineAmount: Decimal | number | null;
      paidAmount: Decimal | number | null;
    }> = (pendingInvoices as any[]).filter((inv) => {
      const net = new Decimal(inv.netAmount ?? 0);
      const fine = new Decimal(inv.lateFineAmount ?? 0);
      const paid = new Decimal(inv.paidAmount ?? 0);
      return net.plus(fine).minus(paid).gt(0);
    });

    const pendingFeeCount = pendingFeesRaw.length;
    const pendingFeeAmount = pendingFeesRaw.reduce((t, inv) => {
      const net = new Decimal(inv.netAmount ?? 0);
      const fine = new Decimal(inv.lateFineAmount ?? 0);
      const paid = new Decimal(inv.paidAmount ?? 0);
      return t.plus(net.plus(fine).minus(paid));
    }, new Decimal(0)).toFixed(2);

    /* ---------- today's admissions (with placement) ---------- */
    const todayIds = todayStudents.map((s) => s.id);
    const todayEnrollments = todayIds.length
      ? await this.prisma.studentEnrollments.findMany({
          where: { studentId: { in: todayIds }, isActive: true },
        })
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
    const pendingStudentIds = Array.from(new Set(pendingFeesRaw.map((r) => r.studentId)));
    const pendingStudents = pendingStudentIds.length
      ? await this.prisma.students.findMany({ where: { id: { in: pendingStudentIds } } })
      : [];
    const studentById = new Map(pendingStudents.map((s) => [s.id, s]));
    const pendingFees: PendingFeeRow[] = pendingFeesRaw.map((r) => {
      const dueDate = toDateOnly(r.dueDate);
      const net = new Decimal(r.netAmount ?? 0);
      const fine = new Decimal(r.lateFineAmount ?? 0);
      const paid = new Decimal(r.paidAmount ?? 0);
      return {
        invoiceId: r.id,
        invoiceNo: r.invoiceNo,
        studentId: r.studentId,
        studentUniqueId: studentById.get(r.studentId)?.studentUniqueId ?? '—',
        fullNameEn: studentById.get(r.studentId)?.fullNameEn ?? '—',
        billingPeriod: r.billingPeriod,
        dueDate,
        netAmount: net.toFixed(2),
        paidAmount: paid.toFixed(2),
        outstanding: net.plus(fine).minus(paid).toFixed(2),
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
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Normalize a raw DATE (mysql2 returns a Date) to a local YYYY-MM-DD string. */
function toDateOnly(v: string | Date): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}
