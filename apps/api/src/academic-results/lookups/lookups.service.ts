import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LookupOption {
  value: string;
  label: string;
  count: number;
}

export interface ScopeLookupResult {
  sessions: LookupOption[];
  classes: LookupOption[];
  sections: LookupOption[];
}

/**
 * Result Engine AD-3 — scope lookups derived from existing data.
 *
 * `academic_session_id`, `class_or_dept_id`, `section_or_batch_id` and
 * `shift_id` are opaque UUIDs owned by a future calendar module, so the Result
 * Engine never joins them. These endpoints return the **distinct values already
 * present** in the engine's own tables so every filter dropdown offers real
 * values instead of hand-typed UUIDs:
 *   - sessions: union of `class_syllabus_subjects`, `student_subject_enrollments`
 *     and `student_enrollments`
 *   - classes: union of `class_syllabus_subjects` and `student_enrollments`
 *   - sections: `student_enrollments.section_or_batch_id` (non-null)
 *
 * The option shape (`{ value, label, count }`) matches the admissions
 * `filter-options` endpoint so the web client can switch over transparently.
 */
@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  sessions(): Promise<LookupOption[]> {
    return this.unionCounts([
      () =>
        this.prisma.classSyllabusSubjects.groupBy({
          by: ['academicSessionId'],
          _count: { _all: true },
        }),
      () =>
        this.prisma.studentSubjectEnrollments.groupBy({
          by: ['academicSessionId'],
          _count: { _all: true },
        }),
      () =>
        this.prisma.studentEnrollments.groupBy({
          by: ['academicSessionId'],
          where: { isActive: true },
          _count: { _all: true },
        }),
    ]);
  }

  async classes(academicSessionId?: string): Promise<LookupOption[]> {
    return this.unionCounts([
      () =>
        this.prisma.classSyllabusSubjects.groupBy({
          by: ['classOrDeptId'],
          where: academicSessionId ? { academicSessionId } : undefined,
          _count: { _all: true },
        }),
      () =>
        this.prisma.studentEnrollments.groupBy({
          by: ['classOrDeptId'],
          where: { isActive: true, ...(academicSessionId ? { academicSessionId } : {}) },
          _count: { _all: true },
        }),
    ]);
  }

  async sections(academicSessionId?: string, classOrDeptId?: string): Promise<LookupOption[]> {
    const raw = await this.prisma.studentEnrollments.groupBy({
      by: ['sectionOrBatchId'],
      where: {
        isActive: true,
        sectionOrBatchId: { not: null },
        ...(academicSessionId ? { academicSessionId } : {}),
        ...(classOrDeptId ? { classOrDeptId } : {}),
      },
      _count: { _all: true },
    });
    return raw
      .filter((r) => r.sectionOrBatchId != null)
      .map((r) => toOption(r.sectionOrBatchId as string, r._count._all));
  }

  async scope(academicSessionId?: string, classOrDeptId?: string): Promise<ScopeLookupResult> {
    const [sessions, classes, sections] = await Promise.all([
      this.sessions(),
      this.classes(academicSessionId),
      this.sections(academicSessionId, classOrDeptId),
    ]);
    return { sessions, classes, sections };
  }

  /* ================= internals ================= */

  /**
   * Merges several `groupBy` results on the group's key, summing counts so a
   * value present in N tables is listed once with its total usage.
   */
  private async unionCounts<T extends Record<string, unknown>>(
    queries: Array<() => Promise<T[]>>,
  ): Promise<LookupOption[]> {
    const totals = new Map<string, number>();
    for (const run of queries) {
      const rows = await run();
      for (const row of rows) {
        const value = firstStringValue(row);
        const count = countOf(row);
        if (!value) continue;
        totals.set(value, (totals.get(value) ?? 0) + count);
      }
    }
    return [...totals.entries()]
      .map(([value, count]) => toOption(value, count))
      .sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
  }
}

function firstStringValue(row: Record<string, unknown>): string | null {
  for (const value of Object.values(row)) {
    if (typeof value === 'string' && value) return value;
  }
  return null;
}

function countOf(row: Record<string, unknown>): number {
  const count = row._count as { _all?: unknown } | undefined;
  return typeof count?._all === 'number' ? count._all : 0;
}

function toOption(value: string, count: number): LookupOption {
  return { value, label: `${value} (${count})`, count };
}
