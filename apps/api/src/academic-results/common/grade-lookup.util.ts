import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { dec } from './decimal.util';

export interface GradeRange {
  minPercentage: string;
  maxPercentage: string | null;
  letterGrade: string;
  gradePoint: string;
  descriptiveRemark: string | null;
}

/**
 * CC-01 / AD-5 — deterministic, gap-proof lookup. Returns the range with the
 * greatest `min_percentage` that is `<= value` (so `79.5 → A` in the 70–79
 * band), or `null` when the scale has no ranges.
 */
export function resolvePercentageRange(
  percentage: Decimal.Value,
  ranges: GradeRange[],
): GradeRange | null {
  const value = new Decimal(percentage == null || percentage === '' ? '0' : percentage);
  let found: GradeRange | null = null;
  for (const range of sortByMin(ranges)) {
    if (dec(range.minPercentage).lte(value)) found = range;
    else break;
  }
  return found;
}

/**
 * Resolves a final GPA/CGPA to its letter via the *grade-point* thresholds
 * (CC-01): the range with the greatest `grade_point <= value`.
 */
export function resolveGpaRange(value: Decimal.Value, ranges: GradeRange[]): GradeRange | null {
  const target = new Decimal(value == null || value === '' ? '0' : value);
  const byPoint = [...ranges].sort((a, b) =>
    new Decimal(String(b.gradePoint ?? 0)).comparedTo(new Decimal(String(a.gradePoint ?? 0))),
  );
  for (const range of byPoint) {
    if (dec(range.gradePoint).lte(target)) return range;
  }
  return byPoint.length ? byPoint[byPoint.length - 1] : null;
}

/**
 * CC-01 validation: the lowest threshold must be `0` and thresholds must be
 * strictly increasing, which guarantees full decimal coverage.
 */
export function validateGradeRanges(ranges: GradeRange[], context = 'grading scale'): void {
  if (!ranges.length) throw new BadRequestException(`${context} has no ranges`);
  const sorted = sortByMin(ranges);
  if (!dec(sorted[0].minPercentage).isZero()) {
    throw new BadRequestException(`${context}: the lowest min_percentage must be 0`);
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (dec(sorted[i].minPercentage).lte(dec(sorted[i - 1].minPercentage))) {
      throw new BadRequestException(
        `${context}: thresholds must be strictly increasing (${sorted[i - 1].minPercentage} then ${sorted[i].minPercentage})`,
      );
    }
  }
}

function sortByMin(ranges: GradeRange[]): GradeRange[] {
  return [...ranges].sort((a, b) => dec(a.minPercentage).comparedTo(dec(b.minPercentage)));
}
