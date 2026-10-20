import Decimal from 'decimal.js';

/** `exam_terms.mark_rounding_mode` (CC-02). */
export type MarkRoundingMode = 'HALF_UP_INTEGER' | 'CEILING_INTEGER' | 'TWO_DECIMALS';

export const MARK_ROUNDING_MODES: MarkRoundingMode[] = [
  'HALF_UP_INTEGER',
  'CEILING_INTEGER',
  'TWO_DECIMALS',
];

/**
 * CC-02 — the subject total is rounded before the percentage is derived.
 * `HALF_UP_INTEGER` (default) → 0 dp half-up; `CEILING_INTEGER` → 0 dp ceiling;
 * `TWO_DECIMALS` → 2 dp half-up.
 */
export function applyMarkRounding(total: Decimal.Value, mode: string): Decimal {
  const value = new Decimal(total == null || total === '' ? '0' : total);
  switch (mode as MarkRoundingMode) {
    case 'CEILING_INTEGER':
      return value.toDecimalPlaces(0, Decimal.ROUND_CEIL);
    case 'TWO_DECIMALS':
      return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    case 'HALF_UP_INTEGER':
    default:
      return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  }
}
