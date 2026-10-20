import Decimal from 'decimal.js';
import { dec, round2 } from './decimal.util';

export { dec, round2, fmt2 } from './decimal.util';

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);
export const HUNDRED = new Decimal(100);

/**
 * Σ of decimals (CC-20: accepts the strings Prisma returns for `DECIMAL`
 * columns as well as `Decimal`/`number`).
 *
 * `dec()` rejects negatives, so this is only for non-negative quantities
 * (marks, grade points, credits).
 */
export function sum(values: Array<Decimal.Value | null | undefined>, tag = 'value'): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(dec(value, tag)), new Decimal(0));
}

/** Division guarded against a zero denominator (required by every §5 formula). */
export function safeDiv(
  numerator: Decimal.Value | null | undefined,
  denominator: Decimal.Value | null | undefined,
  fallback: Decimal = new Decimal(0),
): Decimal {
  const divisor = new Decimal(denominator == null || denominator === '' ? '0' : denominator);
  if (divisor.isZero()) return fallback;
  return new Decimal(numerator == null || numerator === '' ? '0' : numerator).div(divisor);
}

/** `round2(part / whole × 100)` — the percentage convention used throughout §5. */
export function percentageOf(part: Decimal.Value, whole: Decimal.Value): Decimal {
  return round2(safeDiv(part, whole).mul(100));
}

/**
 * `max(0, value)` for the 4th-subject bonus (CC-07). Deliberately takes a
 * `Decimal` because the pre-clamp value is legitimately negative, which `dec()`
 * would reject.
 */
export function clampNonNegative(value: Decimal): Decimal {
  return value.isNegative() ? new Decimal(0) : value;
}

/** Numeric comparison for the Stage 8 comparator (decimals, never floats). */
export function compareDecimal(a: Decimal.Value, b: Decimal.Value): number {
  return new Decimal(a == null || a === '' ? '0' : a).comparedTo(
    new Decimal(b == null || b === '' ? '0' : b),
  );
}
