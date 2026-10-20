import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';

export interface TermAttendance {
  studentId: string;
  percentage: string;
  source: string;
}

export interface AttendanceSlab {
  name: string;
  minAttendancePct: Decimal;
  maxAttendancePct: Decimal;
  awardedMarks: Decimal;
}

/**
 * AD-4 — the single seam for attendance data feeding the Result Engine.
 *
 * Today attendance is a per-term, per-student percentage stored in
 * `student_attendance_summaries` (`source = 'MANUAL'`). If a daily-attendance
 * module is added later, only this adapter changes: `loadTermAttendance` would
 * derive the percentage from daily rows and tag `source = 'DAILY_ATTENDANCE'`.
 * `update` and `clear` must never be called for a non-MANUAL source. `source`
 * records provenance.
 */
@Injectable()
export class AttendanceAdapterService {
  constructor(private readonly prisma: PrismaService) {}

  /** Manual attendance entry for a term (one upsert per student). */
  async upsertManual(
    examTermId: string,
    entries: Array<{ studentId: string; attendancePercentage: string }>,
  ): Promise<{ saved: number }> {
    const prepared = entries.map((entry) => {
      const pct = new Decimal(entry.attendancePercentage);
      if (pct.isNegative() || pct.gt(100)) {
        throw new BadRequestException(
          `attendancePercentage for student ${entry.studentId} must be between 0 and 100`,
        );
      }
      return { studentId: entry.studentId, percentage: pct.toFixed(2) };
    });

    await this.prisma.$transaction(async (tx) => {
      for (const row of prepared) {
        await tx.studentAttendanceSummaries.upsert({
          where: { examTermId_studentId: { examTermId, studentId: row.studentId } },
          create: {
            examTermId,
            studentId: row.studentId,
            attendancePercentage: row.percentage,
            source: 'MANUAL',
          },
          update: { attendancePercentage: row.percentage, source: 'MANUAL' },
        });
      }
    });

    return { saved: prepared.length };
  }

  /** All attendance summaries for a term, keyed by student. */
  async loadTermAttendance(examTermId: string): Promise<Map<string, TermAttendance>> {
    const rows = await this.prisma.studentAttendanceSummaries.findMany({ where: { examTermId } });
    return new Map(
      rows.map((r) => [
        r.studentId,
        { studentId: r.studentId, percentage: String(r.attendancePercentage), source: r.source },
      ]),
    );
  }

  async listTermAttendance(examTermId: string) {
    const rows = await this.prisma.studentAttendanceSummaries.findMany({
      where: { examTermId },
      orderBy: { studentId: 'asc' },
    });
    return rows.map((r) => ({
      studentId: r.studentId,
      attendancePercentage: String(r.attendancePercentage),
      source: r.source,
      updatedAt: r.updatedAt,
    }));
  }

  async loadSlabs(): Promise<AttendanceSlab[]> {
    return this.prisma.attendanceMarkSlabs.findMany({ orderBy: { minAttendancePct: 'desc' } });
  }

  /**
   * The awarded attendance mark for a percentage, from `attendance_mark_slabs`
   * (used by `AUTO_FROM_ATTENDANCE` components). Returns `null` when no slab
   * covers the percentage — the caller records a gap rather than a silent 0.
   */
  resolveSlabAwardedMarks(percentage: Decimal.Value, slabs: AttendanceSlab[]): string | null {
    const pct = new Decimal(percentage ?? 0);
    const slab = slabs.find((s) => pct.gte(s.minAttendancePct) && pct.lte(s.maxAttendancePct));
    return slab ? String(slab.awardedMarks) : null;
  }
}
