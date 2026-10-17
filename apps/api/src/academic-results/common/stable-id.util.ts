import { createHash } from 'crypto';

/**
 * Deterministic 36-char surrogate key for result snapshot rows (CC-15).
 *
 * Re-generating a term deletes and re-inserts its snapshot; deriving the `id`
 * from the natural key (`term:student:subject`) keeps re-runs byte-identical
 * instead of minting new random UUIDs every time.
 */
export function stableRowId(seed: string): string {
  const hex = createHash('sha1').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
