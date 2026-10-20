import { round2 } from './decimal.util';
import type { GradeRange } from './grade-lookup.util';

/* ================= engine input (see §5: pure, DB-free) ================= */

export interface EngineRange extends GradeRange {}

export interface EngineScale {
  scaleType: string;
  maxPoint: string;
  minPassPercentage: string;
  fourthSubjectDeduction: string;
}

export interface EngineSubject {
  id: string;
  subjectCode: string | null;
  subjectName: string | null;
  combinedGroupCode: string | null;
  combinedGroupName: string | null;
  defaultSubjectRole: string;
  creditHours: string;
  fullMarks: string;
  passEvaluationMode: string;
  displayOrder: number;
}

export interface EngineComponent {
  id: string;
  syllabusSubjectId: string;
  componentCode: string;
  componentName: string | null;
  maxRawMarks: string;
  convertedMaxMarks: string;
  minPassMarks: string;
  displayOrder: number;
  sourceType: string;
}

export interface EngineStudent {
  studentId: string;
  classRollNo: number;
  sectionOrBatchId: string | null;
  shiftId: string | null;
}

export interface EngineEnrollment {
  studentId: string;
  syllabusSubjectId: string;
  assignedRole: string;
}

export interface EngineMark {
  studentId: string;
  syllabusSubjectId: string;
  componentId: string;
  convertedMarks: string;
  isAbsent: boolean;
  isExempted: boolean;
}

export interface EngineTerm {
  id: string;
  termType: string;
  markRoundingMode: string;
  minCoursesToPromote: number;
  minCgpaToPromote: string;
}

/** Stage 7 input: the parent's weights and the children's already-published percentages. */
export interface EngineCumulativeInput {
  weights: Array<{ childExamTermId: string; weightPct: string }>;
  childResults: Array<{
    childExamTermId: string;
    studentId: string;
    syllabusSubjectId: string;
    percentage: string;
  }>;
}

export interface EngineInput {
  term: EngineTerm;
  scale: EngineScale;
  ranges: EngineRange[];
  subjects: EngineSubject[];
  components: EngineComponent[];
  students: EngineStudent[];
  enrollments: EngineEnrollment[];
  marks: EngineMark[];
  attendance: Record<string, string>;
  cumulative?: EngineCumulativeInput;
}

/* ================= engine output (the snapshot rows to persist) ================= */

export interface EngineSubjectRow {
  examTermId: string;
  studentId: string;
  syllabusSubjectId: string | null;
  combinedGroupCode: string | null;
  isMergedSummaryRow: boolean;
  assignedRole: string;
  creditHours: string;
  fullMarks: string;
  componentBreakdownJson: string | null;
  totalObtainedMarks: string;
  highestMarksInClass: string;
  percentageMarks: string;
  letterGrade: string;
  gradePoint: string;
  effectiveGpForGpa: string;
  weightedCreditPoints: string;
  isPassed: boolean;
  failReason: string | null;
}

export interface EngineMarksheetRow {
  examTermId: string;
  studentId: string;
  sectionId: string | null;
  shiftId: string | null;
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
  meritPositionClass: number | null;
  meritPositionShift: number | null;
  principalRemark: string | null;
}

export interface EngineOutput {
  subjectRows: EngineSubjectRow[];
  marksheets: EngineMarksheetRow[];
  warnings: string[];
}

/* ================= Prisma row → engine input mappers ================= */
/*
 * Prisma 7 returns `DECIMAL` columns as *strings* at runtime while the generated
 * TS type claims `Decimal`, so mapper inputs are typed `unknown` and coerced
 * with `String()` (CC-20: read as strings, compute with decimal.js).
 */

export function mapScale(row: {
  scaleType: string;
  maxPoint: unknown;
  minPassPercentage: unknown;
  fourthSubjectDeduction: unknown;
}): EngineScale {
  return {
    scaleType: row.scaleType,
    maxPoint: String(row.maxPoint),
    minPassPercentage: String(row.minPassPercentage),
    fourthSubjectDeduction: String(row.fourthSubjectDeduction),
  };
}

export function mapRanges(
  rows: Array<{
    minPercentage: unknown;
    maxPercentage: unknown;
    letterGrade: string;
    gradePoint: unknown;
    descriptiveRemark: string | null;
  }>,
): EngineRange[] {
  return rows.map((row) => ({
    minPercentage: String(row.minPercentage),
    maxPercentage: row.maxPercentage == null ? null : String(row.maxPercentage),
    letterGrade: row.letterGrade,
    gradePoint: String(row.gradePoint),
    descriptiveRemark: row.descriptiveRemark ?? null,
  }));
}

export function mapSubject(row: {
  id: string;
  combinedGroupCode: string | null;
  combinedGroupName: string | null;
  defaultSubjectRole: string;
  creditHours: unknown;
  fullMarks: unknown;
  passEvaluationMode: string;
  displayOrder: number;
  academicSubjects?: { subjectCode: string; subjectName: string } | null;
}): EngineSubject {
  return {
    id: row.id,
    subjectCode: row.academicSubjects?.subjectCode ?? null,
    subjectName: row.academicSubjects?.subjectName ?? null,
    combinedGroupCode: row.combinedGroupCode,
    combinedGroupName: row.combinedGroupName,
    defaultSubjectRole: row.defaultSubjectRole,
    creditHours: String(row.creditHours),
    fullMarks: String(row.fullMarks),
    passEvaluationMode: row.passEvaluationMode,
    displayOrder: row.displayOrder,
  };
}

export function mapComponent(row: {
  id: string;
  syllabusSubjectId: string;
  componentCode: string;
  componentName: string | null;
  maxRawMarks: unknown;
  convertedMaxMarks: unknown;
  minPassMarks: unknown;
  displayOrder: number;
  sourceType: string;
}): EngineComponent {
  return {
    id: row.id,
    syllabusSubjectId: row.syllabusSubjectId,
    componentCode: row.componentCode,
    componentName: row.componentName ?? null,
    maxRawMarks: String(row.maxRawMarks),
    convertedMaxMarks: String(row.convertedMaxMarks),
    minPassMarks: String(row.minPassMarks),
    displayOrder: row.displayOrder,
    sourceType: row.sourceType,
  };
}

export function mapStudent(row: {
  studentId: string;
  classRollNo: number;
  sectionOrBatchId: string | null;
  shiftId: string | null;
}): EngineStudent {
  return {
    studentId: row.studentId,
    classRollNo: row.classRollNo,
    sectionOrBatchId: row.sectionOrBatchId,
    shiftId: row.shiftId,
  };
}

/** Serialises a component breakdown for `component_breakdown_json` (stable key order). */
export function toBreakdownJson(entries: Array<Record<string, unknown>>): string | null {
  return entries.length ? JSON.stringify(entries) : null;
}
