/**
 * Structural comparison used by the parity harness
 * (docs/PRISMA_MIGRATION_PLAN.md §9).
 *
 * Golden values are captured from the pre-wave implementation and compared
 * against the post-wave implementation. Values are normalised first so that
 * ORM-specific representations do not create false differences:
 *   - Decimal / decimal.js  -> string (money + marks compared exactly)
 *   - Date                  -> ISO string
 *   - BigInt                -> string
 *   - Buffer                -> base64
 *   - object keys           -> sorted (key order is irrelevant)
 * Array order is preserved (services guarantee it where it matters).
 */

export interface Difference {
  path: string;
  expected: unknown;
  actual: unknown;
}

function isDecimalLike(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { plus?: unknown }).plus === 'function' &&
    typeof (value as { toFixed?: unknown }).toFixed === 'function'
  );
}

export function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.toString('base64');
  }
  if (isDecimalLike(value)) return String(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = normalize(source[key]);
    return out;
  }
  return value;
}

export function diff(
  expected: unknown,
  actual: unknown,
  path = '$',
  acc: Difference[] = [],
): Difference[] {
  const e = normalize(expected);
  const a = normalize(actual);

  if (Array.isArray(e) || Array.isArray(a)) {
    if (!Array.isArray(e) || !Array.isArray(a)) {
      acc.push({ path, expected: e, actual: a });
      return acc;
    }
    if (e.length !== a.length) {
      acc.push({ path: `${path}.length`, expected: e.length, actual: a.length });
    }
    const max = Math.max(e.length, a.length);
    for (let i = 0; i < max; i++) diff(e[i], a[i], `${path}[${i}]`, acc);
    return acc;
  }

  if (e && a && typeof e === 'object' && typeof a === 'object') {
    const keys = new Set([
      ...Object.keys(e as object),
      ...Object.keys(a as object),
    ]);
    for (const key of [...keys].sort()) {
      diff(
        (e as Record<string, unknown>)[key],
        (a as Record<string, unknown>)[key],
        `${path}.${key}`,
        acc,
      );
    }
    return acc;
  }

  if (e !== a) acc.push({ path, expected: e, actual: a });
  return acc;
}
