"use client";

/**
 * Academic Results (Result Engine) client library — Phase 7.
 *
 * Thin, typed wrappers over the same-origin `/api/academic-results/*` proxy
 * (see `apps/web/src/app/api/academic-results/[...path]/route.ts`), which
 * forwards to the NestJS `academic-results` module.
 *
 * Conventions enforced here so every page stays consistent:
 *   - every list is `SearchSelect`-ready via `toOptions()`/`labelledOptions`
 *   - money/mark formatting goes through `fmt2` (2dp, no locale surprises)
 *   - mutations never invent endpoints; one function per API route
 */

import { apiFetch } from "./api";

const BASE = "/api/academic-results";

/* ================================================================== */
/*  Shared unions (mirror the API validators exactly)                  */
/* ================================================================== */

export const SCALE_TYPES = ["GPA_5", "CGPA_4", "DESCRIPTIVE_ONLY"] as const;
export type ScaleType = (typeof SCALE_TYPES)[number];

export const TERM_TYPES = ["SUB_EXAM_CT", "TERMINAL", "CUMULATIVE_ANNUAL"] as const;
export type TermType = (typeof TERM_TYPES)[number];

export const TERM_STATUSES = ["SETUP", "MARKS_ENTRY", "PROCESSING", "PUBLISHED", "LOCKED"] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

export const SUBJECT_ROLES = ["COMPULSORY", "GROUP_ELECTIVE", "FOURTH_OPTIONAL", "NON_CREDIT"] as const;
export type SubjectRole = (typeof SUBJECT_ROLES)[number];

export const PASS_EVALUATION_MODES = [
  "TOTAL_MARKS_ONLY",
  "SEPARATE_COMPONENTS",
  "COMBINED_PAPER_COMPONENTS",
] as const;
export type PassEvaluationMode = (typeof PASS_EVALUATION_MODES)[number];

export const COMPONENT_CODES = [
  "CT_INCOURSE",
  "ATTENDANCE",
  "CQ_WRITTEN",
  "MCQ",
  "PRACTICAL",
  "VIVA",
] as const;
export type ComponentCode = (typeof COMPONENT_CODES)[number];

export const SOURCE_TYPES = ["MANUAL_ENTRY", "AUTO_FROM_SUB_EXAMS", "AUTO_FROM_ATTENDANCE"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const CT_AGGREGATION_MODES = ["BEST_N_AVERAGE", "BEST_N_SUM", "ALL_AVERAGE", "WEIGHTED_SUM"] as const;
export type CtAggregationMode = (typeof CT_AGGREGATION_MODES)[number];

export const MARK_ROUNDING_MODES = ["HALF_UP_INTEGER", "CEILING_INTEGER", "TWO_DECIMALS"] as const;
export type MarkRoundingMode = (typeof MARK_ROUNDING_MODES)[number];

/** CC-18 state machine — mirrored so the UI only offers legal transitions. */
export const TERM_STATUS_TRANSITIONS: Record<TermStatus, TermStatus[]> = {
  SETUP: ["MARKS_ENTRY"],
  MARKS_ENTRY: ["PROCESSING", "SETUP"],
  PROCESSING: ["PUBLISHED", "MARKS_ENTRY"],
  PUBLISHED: ["LOCKED", "MARKS_ENTRY"],
  LOCKED: [],
};

/** CC-18: `PUBLISHED → MARKS_ENTRY` is controller-only. */
export const CONTROLLER_ONLY_TRANSITIONS: Array<[TermStatus, TermStatus]> = [
  ["PUBLISHED", "MARKS_ENTRY"],
];

export function nextStatuses(from: string): TermStatus[] {
  return TERM_STATUS_TRANSITIONS[from as TermStatus] ?? [];
}

export function isControllerOnlyTransition(from: string, to: string): boolean {
  return CONTROLLER_ONLY_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface SearchOptionLike {
  value: string;
  label: string;
}

export interface GradingScaleRange {
  id?: string;
  gradingScaleId?: string;
  minPercentage: string;
  maxPercentage: string;
  letterGrade: string;
  gradePoint: string;
  descriptiveRemark?: string | null;
}

export interface GradingScale {
  id: string;
  name: string;
  scaleType: ScaleType | string;
  maxPoint: string;
  minPassPoint: string;
  minPassPercentage: string;
  fourthSubjectDeduction: string;
  isActive: boolean;
  gradingScaleRanges?: GradingScaleRange[];
}

export interface AttendanceSlab {
  id: string;
  name: string;
  minAttendancePct: string;
  maxAttendancePct: string;
  awardedMarks: string;
}

export interface MasterSubject {
  id: string;
  subjectCode: string;
  subjectName: string;
  boardStream: string;
  paperNumber: number | null;
}

export interface SyllabusRow {
  id: string;
  academicSessionId: string;
  classOrDeptId: string;
  subjectId: string;
  subjectCode: string | null;
  subjectName: string | null;
  boardStream?: string | null;
  paperNumber?: number | null;
  combinedGroupCode: string | null;
  combinedGroupName: string | null;
  defaultSubjectRole: SubjectRole | string;
  electiveGroup: string | null;
  creditHours: string;
  fullMarks: string;
  passEvaluationMode: PassEvaluationMode | string;
  displayOrder: number;
  enrolledCount?: number;
}

export interface SyllabusMergedGroup {
  groupCode: string;
  combinedGroupName: string | null;
  passEvaluationMode: string;
  defaultSubjectRole: string;
  papers: { subjectId: string; subjectCode: string; subjectName: string; paperNumber: number | null }[];
}

export interface SyllabusValidation {
  groups: SyllabusMergedGroup[];
  issues: { subjectId?: string; groupCode?: string; message: string }[];
  valid: boolean;
}

export interface ExamTerm {
  id: string;
  academicSessionId: string;
  classOrDeptId: string;
  gradingScaleId: string;
  termName: string;
  termType: TermType | string;
  parentTerminalExamId: string | null;
  sequenceNo: number;
  ctAggregationMode: CtAggregationMode | string;
  ctBestCount: number;
  annualWeightPct: string;
  markRoundingMode: MarkRoundingMode | string;
  minCoursesToPromote: number;
  minCgpaToPromote: string;
  status: TermStatus | string;
  createdAt?: string;
  updatedAt?: string;
  componentCount?: number;
  weightCount?: number;
  childCount?: number;
  gradingScale?: GradingScale | null;
}

export interface TermWeight {
  id?: string;
  childExamTermId: string;
  weightPct: string;
  child?: { termName: string; termType: string; sequenceNo: number } | null;
}

export interface TermWeights {
  parentExamTermId: string;
  termType?: string;
  weights: TermWeight[];
  totalWeightPct?: string;
}

export interface SubjectComponent {
  id: string;
  examTermId: string;
  syllabusSubjectId: string;
  componentCode: ComponentCode | string;
  componentName: string | null;
  sourceType: SourceType | string;
  sourceComponentCode: string | null;
  maxRawMarks: string;
  conversionWeightPct: string;
  convertedMaxMarks: string;
  minPassMarks: string;
  displayOrder: number;
}

export interface ComponentReportSubject {
  syllabusSubjectId: string;
  subjectCode: string | null;
  subjectName: string | null;
  fullMarks: string;
  convertedMaxSum: string;
  configured: boolean;
  valid: boolean;
  issues: string[];
  components: SubjectComponent[];
}

export interface ComponentReport {
  termId: string;
  valid: boolean;
  subjects: ComponentReportSubject[];
}

export interface SheetCell {
  rawMarksObtained: string;
  convertedMarks: string;
  isAbsent: boolean;
  isExempted: boolean;
  isPassedComponent: boolean;
}

export interface SheetRow {
  studentId: string;
  studentUniqueId?: string;
  fullNameEn?: string;
  fullNameBn?: string;
  classRollNo?: number;
  sectionOrBatchId?: string | null;
  marks: Record<string, SheetCell | null>;
  convertedTotal: string;
  attendance: { attendancePercentage: string; source?: string } | null;
  editable: boolean;
}

export interface MarksSheet {
  term: { id: string; termName: string; termType: string; status: string; markRoundingMode: string };
  subject: {
    syllabusSubjectId: string;
    subjectCode: string | null;
    subjectName: string | null;
    fullMarks: string;
    passEvaluationMode: string;
    combinedGroupCode: string | null;
    defaultSubjectRole: string;
  };
  rosterSource: string;
  editable: boolean;
  components: (Omit<SubjectComponent, "convertedMaxMarks"> & { convertedMaxMarks: string; editable: boolean })[];
  rows: SheetRow[];
}

export interface BulkMarkRow {
  studentId: string;
  componentId: string;
  rawMarksObtained?: string;
  isAbsent?: boolean;
  isExempted?: boolean;
}

export interface AutoPopulateGap {
  code: string;
  message?: string;
  classRollNo?: number;
  componentCode?: string;
  syllabusSubjectId?: string;
  percentage?: string;
}

export interface AutoPopulateResult {
  updated: number;
  components: number;
  students: number;
  gaps: AutoPopulateGap[];
  message?: string;
}

export interface ImportPlanDiff {
  line: number;
  classRollNo: number;
  componentCode: string;
  rawMarksObtained: string;
  isAbsent: boolean;
  isExempted: boolean;
}

export interface ImportRowError {
  line: number;
  code: string;
  message: string;
  classRollNo?: number;
  componentCode?: string;
}

export interface ImportResult {
  dryRun: boolean;
  /** `false` on a dry run, `true` once committed. */
  committed: boolean;
  /** Parsed data rows in the upload. */
  rows: number;
  /** Dry run only — marks the importer would write. */
  plan?: number;
  /** Dry run only. */
  canCommit?: boolean;
  /** Dry run only — per-cell plan preview. */
  diff?: ImportPlanDiff[];
  /** Rows the importer refused (UNKNOWN_ROLL / OVER_MAX / NOT_MANUAL / INVALID_CELL). */
  errors?: ImportRowError[];
  /** Commit only — marks persisted. */
  saved?: number;
}

export interface AttendanceEntry {
  studentId: string;
  attendancePercentage: string;
  source?: string;
  updatedAt?: string;
}

export interface PreFlightBlocker {
  code: string;
  message: string;
  syllabusSubjectId?: string;
  componentCode?: string;
  missingStudents?: number;
}

export interface PreFlightReport {
  examTermId: string;
  termStatus: string;
  termType: string;
  ok: boolean;
  students: number;
  subjects: number;
  components: number;
  blockers: PreFlightBlocker[];
}

export interface ResultGenerationJob {
  id: string;
  examTermId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | string;
  currentStage: string | null;
  progressPct: number;
  totalStudents: number;
  processedStudents: number;
  errorMessage: string | null;
  requestedBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface TranscriptComponent {
  componentId: string;
  componentCode: string;
  convertedMarks: string;
  minPassMarks: string;
  isAbsent: boolean;
  isExempted: boolean;
  isPassedComponent: boolean;
}

export interface TranscriptSubjectRow {
  syllabusSubjectId: string | null;
  combinedGroupCode: string | null;
  isMergedSummaryRow: boolean;
  assignedRole: string;
  subjectCode: string | null;
  subjectName: string | null;
  creditHours: string;
  fullMarks: string;
  totalObtainedMarks: string;
  highestMarksInClass: string;
  percentageMarks: string;
  letterGrade: string;
  gradePoint: string;
  effectiveGpForGpa: string;
  weightedCreditPoints: string;
  isPassed: boolean;
  failReason: string | null;
  components: TranscriptComponent[];
}

export type TranscriptEntry =
  | { kind: "STANDALONE"; row: TranscriptSubjectRow }
  | {
      kind: "GROUP";
      groupCode: string;
      groupName: string | null;
      /** Merged summary row — the GPA authority. `null` only if it was never generated. */
      merged: TranscriptSubjectRow | null;
      papers: TranscriptSubjectRow[];
    };

export interface Transcript {
  term: { id: string; termName: string; termType: string; status: string; academicSessionId: string; classOrDeptId: string; markRoundingMode: string };
  student: {
    id: string;
    studentUniqueId: string;
    fullNameEn: string;
    fullNameBn: string | null;
    gender: string;
    dateOfBirth: string;
    photoUrl: string | null;
  };
  enrollment: {
    classRollNo: number;
    sectionOrBatchId: string | null;
    shiftId: string | null;
    academicGroup: string;
    boardRegistrationNo: string | null;
  } | null;
  gradingScale: {
    id: string;
    name: string;
    scaleType: string;
    maxPoint: string;
    minPassPercentage: string;
    fourthSubjectDeduction: string;
    ranges: GradingScaleRange[];
  };
  subjects: TranscriptEntry[];
  marksheet: {
    totalCompulsorySubjects: number;
    totalCreditsAttempted: string;
    totalCreditsEarned: string;
    marksWithoutFourth: string;
    marksWithFourth: string;
    gpaWithoutFourth: string;
    fourthSubjectBonusGp: string;
    finalGpaOrCgpa: string;
    finalLetterGrade: string;
    failedSubjectCount: number;
    attendancePercentage: string;
    resultStatus: string;
    meritPositionSection: number | null;
    meritPositionShift: number | null;
    meritPositionClass: number | null;
    principalRemark: string | null;
    generatedAt: string;
  };
  attendance: { percentage: string; source: string } | null;
  qr: { version: number; payload: string; checksum: string; verifyPath: string };
}

export interface TabulationColumn {
  key: string;
  kind: "SUBJECT" | "PAPER" | "MERGED";
  label: string;
  subjectName?: string | null;
  combinedGroupCode: string | null;
  fullMarks: string | null;
}

export interface TabulationCell {
  totalObtainedMarks: string;
  fullMarks: string;
  percentageMarks: string;
  letterGrade: string;
  gradePoint: string;
  isPassed: boolean;
  failReason: string | null;
  components?: TranscriptComponent[];
  weightedTerms?: { childExamTermId: string; weightPct: string; percentage: string }[];
}

export interface TabulationRow {
  studentId: string;
  studentUniqueId: string | null;
  fullNameEn: string | null;
  fullNameBn: string | null;
  classRollNo?: number | null;
  sectionOrBatchId: string | null;
  shiftId: string | null;
  marks: Record<string, TabulationCell>;
  summary: {
    totalCompulsorySubjects: number;
    totalCreditsAttempted: string;
    totalCreditsEarned: string;
    marksWithoutFourth: string;
    marksWithFourth: string;
    gpaWithoutFourth: string;
    fourthSubjectBonusGp: string;
    finalGpaOrCgpa: string;
    finalLetterGrade: string;
    failedSubjectCount: number;
    attendancePercentage: string;
    resultStatus: string;
    meritPositionSection: number | null;
    meritPositionShift: number | null;
    meritPositionClass: number | null;
  };
}

export interface Tabulation {
  term: { id: string; termName: string; termType: string; status: string; academicSessionId: string; classOrDeptId: string };
  columns: TabulationColumn[];
  students: TabulationRow[];
  totalStudents: number;
}

export interface Analytics {
  term: { id: string; termName: string; termType: string; status: string; academicSessionId: string; classOrDeptId: string };
  overall: {
    appeared: number;
    passed: number;
    failed: number;
    passPercentage: string;
    averageGpa: string;
    highestGpa: string;
    statusCounts: Record<string, number>;
  };
  gradeHistogram: { letterGrade: string; count: number }[];
  subjects: {
    key: string;
    label: string;
    appeared: number;
    passed: number;
    failed: number;
    passPercentage: string;
    averagePercentage: string;
    failReasons: Record<string, number>;
  }[];
  teachers: {
    syllabusSubjectId: string;
    subjectCode: string | null;
    enteredBy: string;
    teacherName: string | null;
    teacherRole: string | null;
    marksEntered: number;
  }[];
}

export interface MeritEntry {
  position: number | null;
  studentId: string;
  studentUniqueId: string | null;
  fullNameEn: string | null;
  fullNameBn: string | null;
  sectionOrBatchId: string | null;
  shiftId: string | null;
  finalGpaOrCgpa: string;
  gpaWithoutFourth: string;
  finalLetterGrade: string;
  marksWithFourth: string;
  marksWithoutFourth: string;
  failedSubjectCount: number;
  attendancePercentage: string;
  resultStatus: string;
  failedSubjects: { label: string | null; failReason: string | null; totalObtainedMarks: string; fullMarks: string }[];
}

export interface MeritList {
  term: { id: string; termName: string; termType: string; status: string; academicSessionId: string; classOrDeptId: string };
  scope: "section" | "shift" | "class";
  total: number;
  entries: MeritEntry[];
}

export interface FailList {
  term: { id: string; termName: string; termType: string; status: string; academicSessionId: string; classOrDeptId: string };
  total: number;
  entries: MeritEntry[];
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface ScopeFilterOptions {
  sessions: FilterOption[];
  classes: FilterOption[];
  sections: FilterOption[];
}

/* ================================================================== */
/*  Formatting helpers                                                 */
/* ================================================================== */

/** Fixed 2-dp formatting for marks / GPAs (`0` → `0.00`). */
export function fmt2(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0.00";
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

/** 2-dp with thousands separators (readability for broadsheets). */
export function fmt2Grouped(value: string | number | null | undefined): string {
  const num = Number.parseFloat(fmt2(value));
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toOptions(rows: { id: string; label: string }[]): SearchOptionLike[] {
  return rows.map((row) => ({ value: row.id, label: row.label }));
}

/** Turn `{value,label}` pairs into a `SearchOption[]` (drops empties). */
export function filterOptionsToSearch(options: FilterOption[] | undefined): SearchOptionLike[] {
  return (options ?? []).map((option) => ({ value: option.value, label: option.label }));
}

export function shortId(id: string | null | undefined, length = 8): string {
  if (!id) return "—";
  return id.length > length ? `${id.slice(0, length)}…` : id;
}

/* ================================================================== */
/*  Phase 2 — syllabus config                                          */
/* ================================================================== */

export function listMasterSubjects(boardStream?: string) {
  const qs = boardStream ? `?boardStream=${encodeURIComponent(boardStream)}` : "";
  return apiFetch<MasterSubject[]>(`${BASE}/syllabus/master-subjects${qs}`);
}

export function createMasterSubject(input: {
  subjectCode: string;
  subjectName: string;
  boardStream?: string;
  paperNumber?: number | null;
}) {
  return apiFetch<MasterSubject>(`${BASE}/syllabus/master-subjects`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMasterSubject(
  id: string,
  input: Partial<{ subjectCode: string; subjectName: string; boardStream: string; paperNumber: number | null }>,
) {
  return apiFetch<MasterSubject>(`${BASE}/syllabus/master-subjects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMasterSubject(id: string) {
  return apiFetch<{ deleted: true }>(`${BASE}/syllabus/master-subjects/${id}`, { method: "DELETE" });
}

export function listSyllabus(academicSessionId: string, classOrDeptId: string) {
  return apiFetch<SyllabusRow[]>(
    `${BASE}/syllabus/matrix?academicSessionId=${academicSessionId}&classOrDeptId=${classOrDeptId}`,
  );
}

export function validateSyllabus(academicSessionId: string, classOrDeptId: string) {
  return apiFetch<SyllabusValidation>(
    `${BASE}/syllabus/matrix/validate?academicSessionId=${academicSessionId}&classOrDeptId=${classOrDeptId}`,
  );
}

export interface SyllabusRowInput {
  academicSessionId: string;
  classOrDeptId: string;
  subjectId: string;
  combinedGroupCode?: string | null;
  combinedGroupName?: string | null;
  defaultSubjectRole: string;
  electiveGroup?: string | null;
  creditHours?: string;
  fullMarks?: string;
  passEvaluationMode?: string;
  displayOrder?: number;
}

export function upsertSyllabusRow(input: SyllabusRowInput) {
  return apiFetch<SyllabusRow>(`${BASE}/syllabus/matrix`, { method: "POST", body: JSON.stringify(input) });
}

export function bulkUpsertSyllabusRows(rows: SyllabusRowInput[]) {
  return apiFetch<{ saved: number; rows: SyllabusRow[] }>(`${BASE}/syllabus/matrix/bulk`, {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export function cloneSyllabus(input: {
  sourceAcademicSessionId: string;
  targetAcademicSessionId: string;
  classOrDeptIds?: string[];
}) {
  return apiFetch<{ cloned: number; skipped: number; rows: SyllabusRow[] }>(`${BASE}/syllabus/matrix/clone`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteSyllabusRow(id: string) {
  return apiFetch<{ deleted: true }>(`${BASE}/syllabus/matrix/${id}`, { method: "DELETE" });
}

export function bulkEnrollSubjects(input: {
  academicSessionId: string;
  classOrDeptId: string;
  sectionOrBatchId?: string;
  fourthSubjectByStudent?: { studentId: string; syllabusSubjectId: string }[];
  dryRun?: boolean;
}) {
  return apiFetch<{ enrolled: number; students: number; dryRun: boolean; message?: string }>(
    `${BASE}/syllabus/enrollments/bulk`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/* ================================================================== */
/*  Phase 3 — exam setup                                               */
/* ================================================================== */

export function listGradingScales() {
  return apiFetch<GradingScale[]>(`${BASE}/exam-setup/grading-scales`);
}

export function getGradingScale(id: string) {
  return apiFetch<GradingScale>(`${BASE}/exam-setup/grading-scales/${id}`);
}

export function listAttendanceSlabs() {
  return apiFetch<AttendanceSlab[]>(`${BASE}/exam-setup/attendance-slabs`);
}

export interface GradingScaleInput {
  name: string;
  scaleType: string;
  maxPoint: string;
  minPassPoint: string;
  minPassPercentage?: string;
  fourthSubjectDeduction?: string;
  ranges: GradingScaleRange[];
}

export function createGradingScale(input: GradingScaleInput) {
  return apiFetch<GradingScale>(`${BASE}/exam-setup/grading-scales`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGradingScale(id: string, input: Partial<GradingScaleInput> & { isActive?: boolean }) {
  return apiFetch<GradingScale>(`${BASE}/exam-setup/grading-scales/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteGradingScale(id: string) {
  return apiFetch<{ deleted: true }>(`${BASE}/exam-setup/grading-scales/${id}`, { method: "DELETE" });
}

/**
 * Canonical presets for the grading-scale configurator (Phase 7 task 1).
 * Each ladder is gap-free from 0 to 100 so no percentage can miss a grade.
 */
export const GRADING_SCALE_PRESETS: {
  id: string;
  label: string;
  note: string;
  scale: GradingScaleInput;
}[] = [
  {
    id: "NCTB_SECONDARY_5",
    label: "NCTB Secondary 5.00",
    note: "SSC/general secondary — GPA 5.00, pass 33%.",
    scale: {
      name: "NCTB Secondary GPA 5.00",
      scaleType: "GPA_5",
      maxPoint: "5.00",
      minPassPoint: "1.00",
      minPassPercentage: "33.00",
      fourthSubjectDeduction: "2.00",
      ranges: [
        { minPercentage: "80.00", maxPercentage: "100.00", letterGrade: "A+", gradePoint: "5.00" },
        { minPercentage: "70.00", maxPercentage: "79.99", letterGrade: "A", gradePoint: "4.00" },
        { minPercentage: "60.00", maxPercentage: "69.99", letterGrade: "A-", gradePoint: "3.50" },
        { minPercentage: "50.00", maxPercentage: "59.99", letterGrade: "B", gradePoint: "3.00" },
        { minPercentage: "40.00", maxPercentage: "49.99", letterGrade: "C", gradePoint: "2.00" },
        { minPercentage: "33.00", maxPercentage: "39.99", letterGrade: "D", gradePoint: "1.00" },
        { minPercentage: "0.00", maxPercentage: "32.99", letterGrade: "F", gradePoint: "0.00" },
      ],
    },
  },
  {
    id: "MADRASAH_DAKHIL_ALIM",
    label: "Madrasah Dakhil / Alim",
    note: "Same 5.00 ladder as NCTB, kept separate so madrasah terms report on their own scale.",
    scale: {
      name: "Madrasah Dakhil/Alim GPA 5.00",
      scaleType: "GPA_5",
      maxPoint: "5.00",
      minPassPoint: "1.00",
      minPassPercentage: "33.00",
      fourthSubjectDeduction: "2.00",
      ranges: [
        { minPercentage: "80.00", maxPercentage: "100.00", letterGrade: "A+", gradePoint: "5.00" },
        { minPercentage: "70.00", maxPercentage: "79.99", letterGrade: "A", gradePoint: "4.00" },
        { minPercentage: "60.00", maxPercentage: "69.99", letterGrade: "A-", gradePoint: "3.50" },
        { minPercentage: "50.00", maxPercentage: "59.99", letterGrade: "B", gradePoint: "3.00" },
        { minPercentage: "40.00", maxPercentage: "49.99", letterGrade: "C", gradePoint: "2.00" },
        { minPercentage: "33.00", maxPercentage: "39.99", letterGrade: "D", gradePoint: "1.00" },
        { minPercentage: "0.00", maxPercentage: "32.99", letterGrade: "F", gradePoint: "0.00" },
      ],
    },
  },
  {
    id: "NU_HONOURS_4",
    label: "NU Honours 4.00",
    note: "National University / IAu honours — CGPA 4.00, pass 40%, nine bands.",
    scale: {
      name: "NU Honours CGPA 4.00",
      scaleType: "CGPA_4",
      maxPoint: "4.00",
      minPassPoint: "2.00",
      minPassPercentage: "40.00",
      fourthSubjectDeduction: "0.00",
      ranges: [
        { minPercentage: "80.00", maxPercentage: "100.00", letterGrade: "A+", gradePoint: "4.00" },
        { minPercentage: "75.00", maxPercentage: "79.99", letterGrade: "A", gradePoint: "3.75" },
        { minPercentage: "70.00", maxPercentage: "74.99", letterGrade: "A-", gradePoint: "3.50" },
        { minPercentage: "65.00", maxPercentage: "69.99", letterGrade: "B+", gradePoint: "3.25" },
        { minPercentage: "60.00", maxPercentage: "64.99", letterGrade: "B", gradePoint: "3.00" },
        { minPercentage: "55.00", maxPercentage: "59.99", letterGrade: "B-", gradePoint: "2.75" },
        { minPercentage: "50.00", maxPercentage: "54.99", letterGrade: "C+", gradePoint: "2.50" },
        { minPercentage: "45.00", maxPercentage: "49.99", letterGrade: "C", gradePoint: "2.25" },
        { minPercentage: "40.00", maxPercentage: "44.99", letterGrade: "D", gradePoint: "2.00" },
        { minPercentage: "0.00", maxPercentage: "39.99", letterGrade: "F", gradePoint: "0.00" },
      ],
    },
  },
  {
    id: "PRIMARY_4_TIER",
    label: "Primary 4-Tier",
    note: "Descriptive-only scale (CC-12) — tier letters, no GPA arithmetic, no F penalty.",
    scale: {
      name: "Primary 4-Tier Descriptive",
      scaleType: "DESCRIPTIVE_ONLY",
      maxPoint: "0.00",
      minPassPoint: "0.00",
      minPassPercentage: "33.00",
      fourthSubjectDeduction: "0.00",
      ranges: [
        { minPercentage: "80.00", maxPercentage: "100.00", letterGrade: "A+", gradePoint: "0.00", descriptiveRemark: "Excellent" },
        { minPercentage: "60.00", maxPercentage: "79.99", letterGrade: "A", gradePoint: "0.00", descriptiveRemark: "Good" },
        { minPercentage: "40.00", maxPercentage: "59.99", letterGrade: "B", gradePoint: "0.00", descriptiveRemark: "Satisfactory" },
        { minPercentage: "33.00", maxPercentage: "39.99", letterGrade: "C", gradePoint: "0.00", descriptiveRemark: "Needs improvement" },
        { minPercentage: "0.00", maxPercentage: "32.99", letterGrade: "F", gradePoint: "0.00", descriptiveRemark: "Below expectation" },
      ],
    },
  },
];

export function listTerms(params: {
  academicSessionId: string;
  classOrDeptId: string;
  termType?: string;
  status?: string;
}) {
  const qs = new URLSearchParams({
    academicSessionId: params.academicSessionId,
    classOrDeptId: params.classOrDeptId,
  });
  if (params.termType) qs.set("termType", params.termType);
  if (params.status) qs.set("status", params.status);
  return apiFetch<ExamTerm[]>(`${BASE}/exam-setup/terms?${qs.toString()}`);
}

export function createTerm(input: {
  academicSessionId: string;
  classOrDeptId: string;
  gradingScaleId: string;
  termName: string;
  termType: string;
  parentTerminalExamId?: string | null;
  sequenceNo?: number;
  ctAggregationMode?: string;
  ctBestCount?: number;
  annualWeightPct?: string;
  markRoundingMode?: string;
  minCoursesToPromote?: number;
  minCgpaToPromote?: string;
}) {
  return apiFetch<ExamTerm>(`${BASE}/exam-setup/terms`, { method: "POST", body: JSON.stringify(input) });
}

export function getTerm(id: string) {
  return apiFetch<ExamTerm>(`${BASE}/exam-setup/terms/${id}`);
}

export function updateTerm(id: string, input: Partial<Omit<ExamTerm, "id">>) {
  return apiFetch<ExamTerm>(`${BASE}/exam-setup/terms/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTerm(id: string) {
  return apiFetch<{ deleted: true }>(`${BASE}/exam-setup/terms/${id}`, { method: "DELETE" });
}

export function setTermStatus(id: string, status: string, reason?: string) {
  return apiFetch<ExamTerm>(`${BASE}/exam-setup/terms/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
  });
}

export function getTermWeights(termId: string) {
  return apiFetch<TermWeights>(`${BASE}/exam-setup/terms/${termId}/weights`);
}

export function setTermWeights(termId: string, weights: { childExamTermId: string; weightPct: string }[]) {
  return apiFetch<TermWeights>(`${BASE}/exam-setup/terms/${termId}/weights`, {
    method: "PUT",
    body: JSON.stringify({ weights }),
  });
}

export function getTermComponents(termId: string, syllabusSubjectId?: string) {
  const qs = syllabusSubjectId ? `?syllabusSubjectId=${syllabusSubjectId}` : "";
  return apiFetch<SubjectComponent[]>(`${BASE}/exam-setup/terms/${termId}/components${qs}`);
}

export function getComponentReport(termId: string) {
  return apiFetch<ComponentReport>(`${BASE}/exam-setup/terms/${termId}/components/validate`);
}

export interface ComponentInput {
  syllabusSubjectId: string;
  components: {
    componentCode: string;
    componentName?: string;
    sourceType?: string;
    sourceComponentCode?: string | null;
    maxRawMarks: string;
    conversionWeightPct?: string;
    minPassMarks?: string;
    displayOrder?: number;
  }[];
}

export function replaceSubjectComponents(termId: string, input: ComponentInput) {
  return apiFetch<SubjectComponent[]>(`${BASE}/exam-setup/terms/${termId}/components/${input.syllabusSubjectId}`, {
    method: "PUT",
    body: JSON.stringify({ components: input.components }),
  });
}

export function createComponent(termId: string, input: ComponentInput["components"][number] & { syllabusSubjectId: string }) {
  return apiFetch<SubjectComponent>(`${BASE}/exam-setup/terms/${termId}/components`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteComponent(termId: string, componentId: string) {
  return apiFetch<{ deleted: true }>(`${BASE}/exam-setup/terms/${termId}/components/${componentId}`, {
    method: "DELETE",
  });
}

export function bulkCopyComponents(termId: string, input: { sourceSyllabusSubjectId: string; targetSyllabusSubjectIds: string[] }) {
  return apiFetch<{ copied: number; targets: string[] }>(`${BASE}/exam-setup/terms/${termId}/components/bulk-copy`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ================================================================== */
/*  Phase 4 — marks entry                                              */
/* ================================================================== */

export function getMarksSheet(params: { examTermId: string; syllabusSubjectId: string; sectionOrBatchId?: string }) {
  const qs = new URLSearchParams({
    examTermId: params.examTermId,
    syllabusSubjectId: params.syllabusSubjectId,
  });
  if (params.sectionOrBatchId) qs.set("sectionOrBatchId", params.sectionOrBatchId);
  return apiFetch<MarksSheet>(`${BASE}/marks-entry/sheet?${qs.toString()}`);
}

export function bulkSaveMarks(input: { examTermId: string; syllabusSubjectId: string; rows: BulkMarkRow[] }) {
  return apiFetch<{ saved: number; students: number; components: number }>(`${BASE}/marks-entry/marks/bulk`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function autoPopulateMarks(input: { examTermId: string; syllabusSubjectId?: string }) {
  return apiFetch<AutoPopulateResult>(`${BASE}/marks-entry/auto-populate`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Marks import (multipart CSV/OMR upload or inline CSV).
 *
 * Uses a bare `fetch` rather than `apiFetch`: `apiFetch` forces a JSON
 * content-type, and the browser must set the multipart boundary itself.
 * The same-origin proxy forwards the raw body + content-type untouched.
 */
export async function importMarksCsv(input: {
  examTermId: string;
  syllabusSubjectId: string;
  sectionOrBatchId?: string;
  commit?: boolean;
  file?: File;
  csv?: string;
}): Promise<ImportResult> {
  const form = new FormData();
  form.append("examTermId", input.examTermId);
  form.append("syllabusSubjectId", input.syllabusSubjectId);
  if (input.sectionOrBatchId) form.append("sectionOrBatchId", input.sectionOrBatchId);
  form.append("commit", input.commit ? "true" : "false");
  if (input.file) form.append("file", input.file);
  if (input.csv) form.append("csv", input.csv);

  const res = await fetch(`${BASE}/marks-entry/import`, {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new Error("Unauthorized");
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const body = payload as { message?: string | string[]; errors?: ImportRowError[] } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message ?? `Import failed (${res.status})`;
    const error = new Error(message) as Error & { errors?: ImportRowError[] };
    if (body?.errors) error.errors = body.errors;
    throw error;
  }
  return payload as ImportResult;
}

export function listAttendance(examTermId: string) {
  return apiFetch<AttendanceEntry[]>(`${BASE}/marks-entry/attendance?examTermId=${examTermId}`);
}

export function saveAttendance(input: { examTermId: string; entries: { studentId: string; attendancePercentage: string }[] }) {
  return apiFetch<{ saved: number }>(`${BASE}/marks-entry/attendance`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/* ================================================================== */
/*  Phase 5 — calculation & job runner                                 */
/* ================================================================== */

export function getPreFlight(examTermId: string) {
  return apiFetch<PreFlightReport>(`${BASE}/calculation/pre-flight?examTermId=${examTermId}`);
}

export function startResultJob(examTermId: string) {
  return apiFetch<ResultGenerationJob>(`${BASE}/calculation/jobs`, {
    method: "POST",
    body: JSON.stringify({ examTermId }),
  });
}

export function listResultJobs(examTermId: string) {
  return apiFetch<ResultGenerationJob[]>(`${BASE}/calculation/jobs?examTermId=${examTermId}`);
}

export function getResultJob(jobId: string) {
  return apiFetch<ResultGenerationJob>(`${BASE}/calculation/jobs/${jobId}`);
}

export function runResultNow(examTermId: string) {
  return apiFetch<{ job: ResultGenerationJob; subjectRows: number; marksheets: number; warnings: string[] }>(
    `${BASE}/calculation/run-now`,
    { method: "POST", body: JSON.stringify({ examTermId }) },
  );
}

/** Human labels for the engine's stage codes (progress console). */
export const JOB_STAGE_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  SYNC_AUTO_COMPONENTS: "Aggregating CTs & attendance",
  LOAD_SCALE: "Loading grading scale",
  LOAD_SYLLABUS: "Loading syllabus & components",
  LOAD_MARKS: "Loading marks",
  LOAD: "Merging papers",
  PERSIST: "Computing GPA & saving snapshots",
  DONE: "Completed",
  FAILED: "Failed",
};

/** Ordered progress steps shown by the process console. */
export const JOB_STAGE_SEQUENCE: string[] = [
  "QUEUED",
  "SYNC_AUTO_COMPONENTS",
  "LOAD_SCALE",
  "LOAD_SYLLABUS",
  "LOAD_MARKS",
  "LOAD",
  "PERSIST",
  "DONE",
];

export function jobStageLabel(stage: string | null | undefined): string {
  if (!stage) return "—";
  return JOB_STAGE_LABELS[stage] ?? stage.replace(/_/g, " ").toLowerCase();
}

/* ================================================================== */
/*  Phase 6 — reports                                                  */
/* ================================================================== */

export function getTranscript(examTermId: string, studentId: string) {
  return apiFetch<Transcript>(`${BASE}/reports/transcript?examTermId=${examTermId}&studentId=${studentId}`);
}

export function getTabulation(params: { examTermId: string; sectionOrBatchId?: string; includeComponents?: boolean }) {
  const qs = new URLSearchParams({ examTermId: params.examTermId });
  if (params.sectionOrBatchId) qs.set("sectionOrBatchId", params.sectionOrBatchId);
  if (params.includeComponents === false) qs.set("includeComponents", "false");
  return apiFetch<Tabulation>(`${BASE}/reports/tabulation?${qs.toString()}`);
}

export function getAnalytics(examTermId: string) {
  return apiFetch<Analytics>(`${BASE}/reports/analytics?examTermId=${examTermId}`);
}

export function getMeritList(params: {
  examTermId: string;
  scope?: "section" | "shift" | "class";
  sectionOrBatchId?: string;
  shiftId?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams({ examTermId: params.examTermId });
  if (params.scope) qs.set("scope", params.scope);
  if (params.sectionOrBatchId) qs.set("sectionOrBatchId", params.sectionOrBatchId);
  if (params.shiftId) qs.set("shiftId", params.shiftId);
  if (params.limit) qs.set("limit", String(params.limit));
  return apiFetch<MeritList>(`${BASE}/reports/merit-list?${qs.toString()}`);
}

export function getFailList(params: { examTermId: string; sectionOrBatchId?: string; limit?: number }) {
  const qs = new URLSearchParams({ examTermId: params.examTermId });
  if (params.sectionOrBatchId) qs.set("sectionOrBatchId", params.sectionOrBatchId);
  if (params.limit) qs.set("limit", String(params.limit));
  return apiFetch<FailList>(`${BASE}/reports/fail-list?${qs.toString()}`);
}

/* ================================================================== */
/*  Academic setup — session + class/dept master data               */
/* ================================================================== */

export interface AcademicSession {
  id: string;
  sessionName: string;
  sessionCode: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  isCurrent: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassOrDept {
  id: string;
  name: string;
  code: string;
  level: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const CLASS_LEVELS = ["PLAY", "SCHOOL", "COLLEGE", "MADRASAH", "UNIVERSITY"] as const;

export function listAcademicSessions(includeInactive = false) {
  return apiFetch<AcademicSession[]>(
    `${BASE}/academic-setup/sessions${includeInactive ? "?includeInactive=true" : ""}`,
  );
}

export function createAcademicSession(input: {
  sessionName: string;
  sessionCode: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  isCurrent?: boolean;
}) {
  return apiFetch<AcademicSession>(`${BASE}/academic-setup/sessions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAcademicSession(id: string, input: Partial<Omit<AcademicSession, "id">>) {
  return apiFetch<AcademicSession>(`${BASE}/academic-setup/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAcademicSession(id: string) {
  return apiFetch<{ deleted: true }>(`${BASE}/academic-setup/sessions/${id}`, { method: "DELETE" });
}

export function listClassOrDepts(params?: { includeInactive?: boolean; level?: string }) {
  const qs = new URLSearchParams();
  if (params?.includeInactive) qs.set("includeInactive", "true");
  if (params?.level) qs.set("level", params.level);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return apiFetch<ClassOrDept[]>(`${BASE}/academic-setup/classes${suffix}`);
}

export function createClassOrDept(input: {
  name: string;
  code: string;
  level?: string;
  displayOrder?: number;
  isActive?: boolean;
}) {
  return apiFetch<ClassOrDept>(`${BASE}/academic-setup/classes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateClassOrDept(id: string, input: Partial<Omit<ClassOrDept, "id">>) {
  return apiFetch<ClassOrDept>(`${BASE}/academic-setup/classes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteClassOrDept(id: string) {
  return apiFetch<{ deleted: true }>(`${BASE}/academic-setup/classes/${id}`, { method: "DELETE" });
}

/* ================================================================== */
/*  Exam term types (dynamic master)                                  */
/* ================================================================== */

export interface ExamTermType {
  id: string;
  name: string;
  code: string;
  engineBehavior: EngineBehavior | string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const ENGINE_BEHAVIORS = ["SUB_EXAM_CT", "TERMINAL", "CUMULATIVE_ANNUAL"] as const;
export type EngineBehavior = (typeof ENGINE_BEHAVIORS)[number];

export function listExamTermTypes(includeInactive = false) {
  return apiFetch<ExamTermType[]>(
    `${BASE}/academic-setup/term-types${includeInactive ? "?includeInactive=true" : ""}`,
  );
}

export function createExamTermType(input: {
  name: string;
  code: string;
  engineBehavior: string;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}) {
  return apiFetch<ExamTermType>(`${BASE}/academic-setup/term-types`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateExamTermType(id: string, input: Partial<Omit<ExamTermType, "id">>) {
  return apiFetch<ExamTermType>(`${BASE}/academic-setup/term-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteExamTermType(id: string) {
  return apiFetch<{ deleted: true }>(`${BASE}/academic-setup/term-types/${id}`, { method: "DELETE" });
}

/* ================================================================== */
/*  Scope helpers (AD-3 — options derived from existing enrollments)   */
/* ================================================================== */

/** Distinct session / class / section ids present in Result-Engine data (AD-3). */
export function getScopeFilterOptions(params?: { academicSessionId?: string; classOrDeptId?: string }) {
  const qs = new URLSearchParams();
  if (params?.academicSessionId) qs.set("academicSessionId", params.academicSessionId);
  if (params?.classOrDeptId) qs.set("classOrDeptId", params.classOrDeptId);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  // Prefer the Result-Engine lookups (AD-3); fall back to the admissions
  // directory options so older API deployments keep working.
  return apiFetch<ScopeFilterOptions>(`${BASE}/lookups/scope${suffix}`).catch(() =>
    apiFetch<ScopeFilterOptions>("/api/admissions/students/filter-options"),
  );
}

/** CSV download for any already-fetched report (no server round-trip). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (cell: string | number | null | undefined) => {
    const text = cell === null || cell === undefined ? "" : String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
