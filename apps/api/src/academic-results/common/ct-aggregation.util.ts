import Decimal from 'decimal.js';

export type CtAggregationMode = 'BEST_N_AVERAGE' | 'BEST_N_SUM' | 'ALL_AVERAGE' | 'WEIGHTED_SUM';

/** One child sub-exam's contribution: `f = converted / childMax`, plus its annual weight. */
export interface CtFraction {
  /** Converted mark ÷ child converted max (absent ⇒ 0). */
  f: Decimal;
  /** Child `annual_weight_pct` (used only by WEIGHTED_SUM). */
  weight: Decimal;
}

/**
 * CC-06 sub-exam (CT/Incourse) aggregation.
 *
 * Returns the aggregate fraction of the parent component's `converted_max_marks`,
 * or `null` when `k = 0` (no child sub-exams carry the component) — the caller
 * must surface that as a pre-flight blocker rather than a silent 0.
 */
export function aggregateCt(
  mode: string,
  bestCount: number,
  items: CtFraction[],
): Decimal | null {
  if (!items.length) return null;
  const capOne = (d: Decimal) => Decimal.min(d, 1);
  const topN = (n: number) =>
    [...items].sort((a, b) => b.f.comparedTo(a.f)).slice(0, Math.min(Math.max(n, 1), items.length));

  switch (mode as CtAggregationMode) {
    case 'ALL_AVERAGE':
      return items.reduce((total, i) => total.plus(i.f), new Decimal(0)).div(items.length);
    case 'BEST_N_AVERAGE': {
      const top = topN(bestCount);
      return top.reduce((total, i) => total.plus(i.f), new Decimal(0)).div(top.length);
    }
    case 'BEST_N_SUM': {
      const top = topN(bestCount);
      return capOne(top.reduce((total, i) => total.plus(i.f), new Decimal(0)));
    }
    case 'WEIGHTED_SUM':
      return capOne(
        items.reduce((total, i) => total.plus(i.f.mul(i.weight).div(100)), new Decimal(0)),
      );
    default:
      return null;
  }
}
