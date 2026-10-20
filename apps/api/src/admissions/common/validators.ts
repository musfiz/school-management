/**
 * Phase 1 — Bangladeshi BRN / NID validators (Plan Phase 1, common/).
 * BRN: 17-digit birth certificate number. NID: 10-digit (smart card),
 * 13-digit or 17-digit legacy numbers. Digits only (spaces/dashes stripped).
 */

const digitsOnly = (v: string): string => (v ?? '').replace(/\D/g, '');

/** 17-digit Bangladesh Birth Registration Number. */
export function isValidBrn(raw: string): boolean {
  return /^\d{17}$/.test(digitsOnly(raw));
}

/** 10 / 13 / 17-digit Bangladesh National ID. */
export function isValidNid(raw: string): boolean {
  const d = digitsOnly(raw);
  return d.length === 10 || d.length === 13 || d.length === 17;
}

/** BD mobile: 01XXXXXXXXX (also accepts +880 / 880 prefixes). */
export function isValidBdPhone(raw: string): boolean {
  let d = digitsOnly(raw);
  if (d.length === 13 && d.startsWith('880')) d = `0${d.slice(3)}`;
  else if (d.length === 12 && d.startsWith('88')) d = `0${d.slice(2)}`;
  return /^01\d{9}$/.test(d);
}

/* ================= Result Engine §PHASE 2 — combined-paper group rules ================= */

/**
 * How a subject's component marks decide pass.
 * `SEPARATE_COMPONENTS` — every component (CQ/MCQ/Practical) must pass on its own.
 * `COMBINED_PAPER_COMPONENTS` — 1st + 2nd paper are merged into one subject total
 * (Result Engine CC-05); the merged rows share a `combinedGroupCode`.
 */
export const PASS_EVALUATION_MODES = ['SEPARATE_COMPONENTS', 'COMBINED_PAPER_COMPONENTS'] as const;
export type PassEvaluationMode = (typeof PASS_EVALUATION_MODES)[number];

/** The subset of a `class_syllabus_subjects` row the merged-group rules depend on. */
export interface MergedGroupRow {
  subjectId: string;
  combinedGroupCode: string | null;
  passEvaluationMode: string;
  defaultSubjectRole: string;
}

export type MergedGroupIssueCode =
  | 'MERGE_MODE_REQUIRES_CODE'
  | 'MERGE_CODE_REQUIRES_MODE'
  | 'MERGE_MODE_MISMATCH'
  | 'MERGE_ROLE_MISMATCH';

export interface MergedGroupIssue {
  groupCode: string | null;
  code: MergedGroupIssueCode;
  message: string;
}

/**
 * Validates the combined-paper rules for one class scope (Result Engine §PHASE 2
 * task 3): rows sharing a `combined_group_code` must share both
 * `pass_evaluation_mode` and `default_subject_role`, and the group code and
 * `COMBINED_PAPER_COMPONENTS` mode are mutually required.
 */
export function findMergedGroupIssues(rows: MergedGroupRow[]): MergedGroupIssue[] {
  const issues: MergedGroupIssue[] = [];
  const byCode = new Map<string, MergedGroupRow[]>();

  for (const row of rows) {
    if (row.passEvaluationMode === 'COMBINED_PAPER_COMPONENTS' && !row.combinedGroupCode) {
      issues.push({
        groupCode: null,
        code: 'MERGE_MODE_REQUIRES_CODE',
        message: `subject ${row.subjectId}: passEvaluationMode=COMBINED_PAPER_COMPONENTS requires a combinedGroupCode`,
      });
    }
    if (row.combinedGroupCode && row.passEvaluationMode !== 'COMBINED_PAPER_COMPONENTS') {
      issues.push({
        groupCode: row.combinedGroupCode,
        code: 'MERGE_CODE_REQUIRES_MODE',
        message: `group "${row.combinedGroupCode}": combinedGroupCode requires passEvaluationMode=COMBINED_PAPER_COMPONENTS (got ${row.passEvaluationMode})`,
      });
    }
    if (row.combinedGroupCode) {
      const list = byCode.get(row.combinedGroupCode) ?? [];
      list.push(row);
      byCode.set(row.combinedGroupCode, list);
    }
  }

  for (const [groupCode, list] of byCode) {
    const modes = new Set(list.map((r) => r.passEvaluationMode));
    if (modes.size > 1) {
      issues.push({
        groupCode,
        code: 'MERGE_MODE_MISMATCH',
        message: `group "${groupCode}": rows must share one passEvaluationMode — found ${[...modes].join(', ')}`,
      });
    }
    const roles = new Set(list.map((r) => r.defaultSubjectRole));
    if (roles.size > 1) {
      issues.push({
        groupCode,
        code: 'MERGE_ROLE_MISMATCH',
        message: `group "${groupCode}": rows must share one defaultSubjectRole — found ${[...roles].join(', ')}`,
      });
    }
  }

  return issues;
}
