/**
 * Wire-format compatibility helpers (docs/PRISMA_MIGRATION_PLAN.md, Wave 1).
 *
 * Prisma names timestamps `createdAt` / `updatedAt` (camelCase), but the CMS API
 * contract was defined by the TypeORM entities it replaces: nine of the ten Wave
 * 1 entities expose snake_case `created_at` / `updated_at` properties, and Nest
 * serialises service results straight to JSON. To keep the wire format
 * byte-identical during the strangler migration, migrated CMS services funnel
 * rows through these helpers, which rename the two timestamps and drop the
 * camelCase originals.
 *
 * `Notices` is the exception (its entity already used camelCase), so it returns
 * Prisma rows directly.
 */

type PrismaTimestamps = { createdAt?: unknown; updatedAt?: unknown };

/** A Prisma row with its camelCase timestamps renamed to the snake_case wire keys. */
export type Wire<T extends PrismaTimestamps> = Omit<T, 'createdAt' | 'updatedAt'> & {
  created_at?: Date | null;
  updated_at?: Date | null;
};

export function toWire<T extends PrismaTimestamps>(row: T): Wire<T> {
  const { createdAt, updatedAt, ...rest } = row;
  const wire = rest as Wire<T>;
  if (createdAt !== undefined) wire.created_at = createdAt as Date | null;
  if (updatedAt !== undefined) wire.updated_at = updatedAt as Date | null;
  return wire;
}

export function toWireList<T extends PrismaTimestamps>(rows: T[]): Wire<T>[] {
  return rows.map(toWire);
}

/**
 * Coerce a date string (e.g. the `YYYY-MM-DD` values the DTOs carry) into a
 * `Date` for Prisma's `@db.Date` columns. `null` / `undefined` / existing
 * `Date`s pass through unchanged, matching TypeORM's string passthrough.
 */
export function toDateValue(
  value: string | Date | null | undefined,
): Date {
  if (value === null || value === undefined) return value as unknown as Date;
  if (value instanceof Date) return value;
  return new Date(value);
}

/**
 * Project a `@db.Date` value back to the `YYYY-MM-DD` string TypeORM used to
 * return. The wire-format Prisma extension (`wire.extension.ts`) already does
 * this at runtime for known DATE field names; this helper keeps the service
 * code type-checked where a `Date`-typed Prisma field must satisfy a
 * `string`-typed DTO field.
 */
export function toDateOnly(value: Date | string): string;
export function toDateOnly(value: Date | string | null | undefined): string | null;
export function toDateOnly(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
