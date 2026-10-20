import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { dec, round2 } from '../../common/decimal.util';

export { dec };

/* ================= enums (VARCHAR-backed, AD-10) ================= */

export const TERM_TYPES = ['SUB_EXAM_CT', 'TERMINAL', 'CUMULATIVE_ANNUAL'] as const;
export type TermType = (typeof TERM_TYPES)[number];

/** AD-5 / §1 — the three grading-scale families the engine supports. */
export const SCALE_TYPES = ['GPA_5', 'CGPA_4', 'DESCRIPTIVE_ONLY'] as const;
export type ScaleType = (typeof SCALE_TYPES)[number];

export const TERM_STATUSES = ['SETUP', 'MARKS_ENTRY', 'PROCESSING', 'PUBLISHED', 'LOCKED'] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

export const COMPONENT_CODES = [
  'CT_INCOURSE',
  'ATTENDANCE',
  'CQ_WRITTEN',
  'MCQ',
  'PRACTICAL',
  'VIVA',
] as const;
export type ComponentCode = (typeof COMPONENT_CODES)[number];

export const SOURCE_TYPES = ['MANUAL_ENTRY', 'AUTO_FROM_SUB_EXAMS', 'AUTO_FROM_ATTENDANCE'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const CT_AGGREGATION_MODES = ['BEST_N_AVERAGE', 'BEST_N_SUM', 'ALL_AVERAGE', 'WEIGHTED_SUM'] as const;
export type CtAggregationMode = (typeof CT_AGGREGATION_MODES)[number];

export const MARK_ROUNDING_MODES = ['HALF_UP_INTEGER', 'CEILING_INTEGER', 'TWO_DECIMALS'] as const;
export type MarkRoundingMode = (typeof MARK_ROUNDING_MODES)[number];

/**
 * CC-18 state machine. `PROCESSING → MARKS_ENTRY` lets a failed generation be
 * retried without re-publishing; `MARKS_ENTRY → SETUP` re-opens config (the
 * service blocks it once any marks exist).
 */
export const TERM_STATUS_TRANSITIONS: Record<TermStatus, TermStatus[]> = {
  SETUP: ['MARKS_ENTRY'],
  MARKS_ENTRY: ['PROCESSING', 'SETUP'],
  PROCESSING: ['PUBLISHED', 'MARKS_ENTRY'],
  PUBLISHED: ['LOCKED', 'MARKS_ENTRY'],
  LOCKED: [],
};

/** CC-18: only an EXAM_CONTROLLER may reopen a published term. */
export const CONTROLLER_ONLY_TRANSITIONS: ReadonlyArray<readonly [TermStatus, TermStatus]> = [
  ['PUBLISHED', 'MARKS_ENTRY'],
];

export function isTransitionAllowed(from: string, to: string): boolean {
  const allowed = TERM_STATUS_TRANSITIONS[from as TermStatus];
  return Boolean(allowed && allowed.includes(to as TermStatus));
}

export function isControllerOnlyTransition(from: string, to: string): boolean {
  return CONTROLLER_ONLY_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

/* ================= decimal helpers (CC-20) ================= */

/** CC-17: `converted_max_marks = round(max_raw_marks × conversion_weight_pct / 100, 2)`. */
export function convertMaxMarks(
  maxRawMarks: Decimal.Value,
  conversionWeightPct: Decimal.Value,
): string {
  return round2(dec(maxRawMarks, 'maxRawMarks').mul(dec(conversionWeightPct, 'conversionWeightPct')).div(100)).toFixed(2);
}

export function sumConvertedMax(components: Array<{ convertedMaxMarks: Decimal.Value }>): string {
  return components
    .reduce((total, c) => total.plus(dec(c.convertedMaxMarks, 'convertedMaxMarks')), new Decimal(0))
    .toFixed(2);
}

/* ================= assertions ================= */

export function assertConvertedFormula(
  component: {
    maxRawMarks: Decimal.Value;
    conversionWeightPct: Decimal.Value;
    convertedMaxMarks: Decimal.Value;
  },
  context: string,
): void {
  const expected = convertMaxMarks(component.maxRawMarks, component.conversionWeightPct);
  if (!dec(component.convertedMaxMarks, 'convertedMaxMarks').equals(expected)) {
    throw new BadRequestException(
      `${context}: converted_max_marks must equal round(max_raw_marks × conversion_weight_pct/100, 2) = ${expected}`,
    );
  }
}

/** CC-17 gate: the set's `Σ converted_max_marks` must equal the syllabus `full_marks`. */
export function assertComponentSetSumsToFullMarks(
  components: Array<{ convertedMaxMarks: Decimal.Value }>,
  fullMarks: Decimal.Value,
  context: string,
): void {
  const sum = sumConvertedMax(components);
  if (!dec(sum, 'sum').equals(dec(fullMarks, 'fullMarks'))) {
    throw new BadRequestException(
      `${context}: Σ converted_max_marks (${sum}) must equal the subject full_marks (${round2(dec(fullMarks, 'fullMarks')).toFixed(2)})`,
    );
  }
}

/** Source rule: `AUTO_FROM_SUB_EXAMS` must name the child component it pulls from. */
export function assertSourceRule(sourceType: string, sourceComponentCode: string | null | undefined, context: string): void {
  if (sourceType === 'AUTO_FROM_SUB_EXAMS' && !sourceComponentCode) {
    throw new BadRequestException(
      `${context}: source_component_code is required when source_type = AUTO_FROM_SUB_EXAMS`,
    );
  }
}

/** AD-7 / CC-11: cumulative-annual child weights must sum to exactly 100. */
export function assertWeightsSumTo100(weights: Array<{ weightPct: Decimal.Value }>, context: string): void {
  const sum = weights.reduce((total, w) => total.plus(dec(w.weightPct, 'weightPct')), new Decimal(0));
  if (!sum.equals(100)) {
    throw new BadRequestException(`${context}: annual weights must sum to exactly 100.00 (got ${sum.toFixed(2)})`);
  }
}

/* ================= option validation ================= */

export function assertOneOf(value: string, allowed: readonly string[], tag: string): void {
  if (!allowed.includes(value)) {
    throw new BadRequestException(`${tag} must be one of ${allowed.join(', ')}`);
  }
}
