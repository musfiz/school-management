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
 * `shift_id` were opaque UUIDs until the academic-setup master tables landed.
 * Sessions/classes now resolve to their master names when present
 * (`2026 · 2026-27 (4)`); unknown ids (legacy rows typed by hand) keep the
 * short-UUID fallback (`a1b2c3d4… (4)`) so nothing ever renders blank.
 * Sections stay derived from enrollments (no master table yet).
 */
@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  async sessions(): Promise<LookupOption[]> {
    const [counts, masterSessions] = await Promise.all([
      this.unionCounts([
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
      ]),
      this.prisma.academicSessions
        .findMany({
          where: { isActive: true },
          orderBy: [{ isCurrent: 'desc' }, { sessionCode: 'desc' }],
        })
        .catch(() => []),
    ]);

    const countMap = new Map(counts.map((c) => [c.value, c.count]));
    const result: LookupOption[] = [];
    const seen = new Set<string>();

    for (const session of masterSessions) {
      seen.add(session.id);
      const count = countMap.get(session.id) ?? 0;
      result.push({
        value: session.id,
        label: `${session.sessionName} · ${session.sessionCode}${count > 0 ? ` (${count})` : ''}`,
        count,
      });
    }

    for (const item of counts) {
      if (!seen.has(item.value)) {
        result.push(item);
      }
    }

    return result;
  }

  async classes(academicSessionId?: string): Promise<LookupOption[]> {
    const [counts, masterClasses] = await Promise.all([
      this.unionCounts([
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
      ]),
      this.prisma.classOrDepts
        .findMany({
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
        })
        .catch(() => []),
    ]);

    const countMap = new Map(counts.map((c) => [c.value, c.count]));
    const result: LookupOption[] = [];
    const seen = new Set<string>();

    for (const cls of masterClasses) {
      seen.add(cls.id);
      const count = countMap.get(cls.id) ?? 0;
      result.push({
        value: cls.id,
        label: `${cls.name} (${cls.code})${count > 0 ? ` (${count})` : ''}`,
        count,
      });
    }

    for (const item of counts) {
      if (!seen.has(item.value)) {
        result.push(item);
      }
    }

    return result;
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

  /** Replaces raw-UUID labels with `name · code` from the master tables. */
  private async withSessionNames(options: LookupOption[]): Promise<LookupOption[]> {
    if (!options.length) return options;
    const masters = await this.prisma.academicSessions.findMany({
      where: { id: { in: options.map((o) => o.value) } },
    });
    const byId = new Map(masters.map((m) => [m.id, m]));
    return options.map((o) => {
      const master = byId.get(o.value);
      if (!master) return o;
      return { ...o, label: `${master.sessionName} · ${master.sessionCode} (${o.count})` };
    });
  }

  /** Replaces raw-UUID labels with `name (code)` from the master tables. */
  private async withClassNames(options: LookupOption[]): Promise<LookupOption[]> {
    if (!options.length) return options;
    const masters = await this.prisma.classOrDepts.findMany({
      where: { id: { in: options.map((o) => o.value) } },
    });
    const byId = new Map(masters.map((m) => [m.id, m]));
    return options.map((o) => {
      const master = byId.get(o.value);
      if (!master) return o;
      return { ...o, label: `${master.name} (${master.code}) (${o.count})` };
    });
  }

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
