import { Prisma } from '../generated/prisma/client';

/**
 * AD-P13 — restore the TypeORM wire format for DECIMAL and DATE columns
 * centrally, so every migrated service keeps the JSON contract its callers
 * were built against.
 *
 * DECIMAL: TypeORM / mysql2 returned `DECIMAL(p,2)` columns as their stored
 * strings (`"800.00"`). Prisma returns `Prisma.Decimal`, which serialises
 * through decimal.js `toString` — dropping trailing zeros (`"800"`). Every
 * pre-migration service, DTO and template was written against the **string**
 * form, so Decimal values are rewritten to their 2-dp string. (All 62 DECIMAL
 * columns in the schema are scale 2.)
 *
 * DATE: TypeORM returned `DATE` columns as `"YYYY-MM-DD"` strings; Prisma
 * returns a `Date` at UTC midnight, which serialises to
 * `"YYYY-MM-DDTHH:MM:SS.000Z"`. The affected field names are enumerated below
 * (every `@db.Date` column in the schema), and only those keys are flattened.
 * Prisma returns DATE values at UTC midnight, so slicing the ISO string yields
 * the same calendar day TypeORM reported.
 *
 * Applied the same way as the password-hashing extension (AD-P8/Q4): one
 * `$extends` in `PrismaService`, so the invariant survives every call site.
 * Writes are unaffected: Prisma accepts numeric strings for Decimal inputs and
 * `Date` / `Date`-parseable values for Date inputs.
 */

/** Every `@db.Date` column in `schema.prisma`, by Prisma field name. */
const DATE_FIELDS = new Set([
  'dateOfBirth',
  'startDate',
  'endDate',
  'transactionDate',
  'publishDate',
  'payDate',
  'issueDate',
  'dueDate',
  'tcDate',
  'activeFrom',
  'activeTo',
  'admissionDate',
  'tcIssueDate',
  'challanDate',
  'jointDate',
  'billDate',
]);

function toWire(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Date) {
    return key !== undefined && DATE_FIELDS.has(key)
      ? value.toISOString().slice(0, 10)
      : value;
  }
  if (value instanceof Prisma.Decimal) return value.toFixed(2);
  if (Array.isArray(value)) return value.map((item) => toWire(item, key));
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const field of Object.keys(source)) out[field] = toWire(source[field], field);
    return out;
  }
  return value;
}

export const wireFormatExtension = Prisma.defineExtension({
  name: 'wire-format',
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        return toWire(await query(args));
      },
    },
  },
});
