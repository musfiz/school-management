/**
 * Result Engine verification fixture (docs/RESULT_ENGINE_EXECUTION_PLAN.md §7).
 *
 * DB-free assertions over the pure calculation pipeline (`buildSnapshots`,
 * `aggregateCt`, `resolvePercentageRange`, `stableRowId`) — the same T1–T15
 * matrix as the jest suite, runnable without a database:
 *
 *   pnpm --filter api run verify:results
 *
 * Exit code is non-zero on the first failure so it can gate a delivery.
 * T14/T15 are timing smoke proxies for the pure engine (the plan's <300 ms /
 * <500 ms targets cover the DB transaction + HTTP path); they print the
 * measured time and fail only on a pathological regression (>10x target).
 */
import 'reflect-metadata';
import Decimal from 'decimal.js';
import { buildSnapshots } from '../src/academic-results/calculation-engine/result-calculation.service';
import { aggregateCt } from '../src/academic-results/common/ct-aggregation.util';
import { resolvePercentageRange } from '../src/academic-results/common/grade-lookup.util';
import { stableRowId } from '../src/academic-results/common/stable-id.util';
import type {
  EngineComponent,
  EngineInput,
  EngineMark,
  EngineRange,
  EngineScale,
  EngineStudent,
  EngineSubject,
  EngineTerm,
} from '../src/academic-results/common/mapper.util';

/* ================= fixtures (mirrors the jest suite) ================= */

const BOARD_5_RANGES: EngineRange[] = [
  { minPercentage: '80', maxPercentage: '100', letterGrade: 'A+', gradePoint: '5.00', descriptiveRemark: 'Outstanding' },
  { minPercentage: '70', maxPercentage: '79.99', letterGrade: 'A', gradePoint: '4.00', descriptiveRemark: 'Excellent' },
  { minPercentage: '60', maxPercentage: '69.99', letterGrade: 'A-', gradePoint: '3.50', descriptiveRemark: null },
  { minPercentage: '50', maxPercentage: '59.99', letterGrade: 'B', gradePoint: '3.00', descriptiveRemark: null },
  { minPercentage: '40', maxPercentage: '49.99', letterGrade: 'C', gradePoint: '2.00', descriptiveRemark: null },
  { minPercentage: '33', maxPercentage: '39.99', letterGrade: 'D', gradePoint: '1.00', descriptiveRemark: null },
  { minPercentage: '0', maxPercentage: '32.99', letterGrade: 'F', gradePoint: '0.00', descriptiveRemark: 'Fail' },
];

const NU_4_RANGES: EngineRange[] = [
  { minPercentage: '80', maxPercentage: '100', letterGrade: 'A+', gradePoint: '4.00', descriptiveRemark: null },
  { minPercentage: '75', maxPercentage: '79.99', letterGrade: 'A', gradePoint: '3.75', descriptiveRemark: null },
  { minPercentage: '70', maxPercentage: '74.99', letterGrade: 'A-', gradePoint: '3.50', descriptiveRemark: null },
  { minPercentage: '65', maxPercentage: '69.99', letterGrade: 'B+', gradePoint: '3.25', descriptiveRemark: null },
  { minPercentage: '60', maxPercentage: '64.99', letterGrade: 'B', gradePoint: '3.00', descriptiveRemark: null },
  { minPercentage: '55', maxPercentage: '59.99', letterGrade: 'B-', gradePoint: '2.75', descriptiveRemark: null },
  { minPercentage: '50', maxPercentage: '54.99', letterGrade: 'C+', gradePoint: '2.50', descriptiveRemark: null },
  { minPercentage: '45', maxPercentage: '49.99', letterGrade: 'C', gradePoint: '2.25', descriptiveRemark: null },
  { minPercentage: '40', maxPercentage: '44.99', letterGrade: 'D', gradePoint: '2.00', descriptiveRemark: null },
  { minPercentage: '0', maxPercentage: '39.99', letterGrade: 'F', gradePoint: '0.00', descriptiveRemark: null },
];

const term = (over: Partial<EngineTerm> = {}): EngineTerm => ({
  id: 'term-1',
  termType: 'TERMINAL',
  markRoundingMode: 'HALF_UP_INTEGER',
  minCoursesToPromote: 0,
  minCgpaToPromote: '0.00',
  ...over,
});

const scale = (over: Partial<EngineScale> = {}): EngineScale => ({
  scaleType: 'GPA_5',
  maxPoint: '5.00',
  minPassPercentage: '33.00',
  fourthSubjectDeduction: '2.00',
  ...over,
});

function subject(index: number, over: Partial<EngineSubject> = {}): EngineSubject {
  return {
    id: `sub-${index}`,
    subjectCode: `S${index}`,
    subjectName: `Subject ${index}`,
    combinedGroupCode: null,
    combinedGroupName: null,
    defaultSubjectRole: 'COMPULSORY',
    creditHours: '4.00',
    fullMarks: '100.00',
    passEvaluationMode: 'SEPARATE_COMPONENTS',
    displayOrder: index,
    ...over,
  };
}

function component(sub: EngineSubject, over: Partial<EngineComponent> = {}): EngineComponent {
  return {
    id: `cmp-${sub.id}-1`,
    syllabusSubjectId: sub.id,
    componentCode: 'CQ_WRITTEN',
    componentName: 'CQ',
    maxRawMarks: '100.00',
    convertedMaxMarks: '100.00',
    minPassMarks: '0.00',
    displayOrder: 1,
    sourceType: 'MANUAL',
    ...over,
  };
}

function mark(studentId: string, sub: EngineSubject, comp: EngineComponent, converted: string): EngineMark {
  return {
    studentId,
    syllabusSubjectId: sub.id,
    componentId: comp.id,
    convertedMarks: converted,
    isAbsent: false,
    isExempted: false,
  };
}

const student = (id: string, roll: number, over: Partial<EngineStudent> = {}): EngineStudent => ({
  studentId: id,
  classRollNo: roll,
  sectionOrBatchId: 'section-a',
  shiftId: 'shift-morning',
  ...over,
});

function input(over: Partial<EngineInput> & Pick<EngineInput, 'term' | 'scale' | 'ranges'>): EngineInput {
  return { subjects: [], components: [], students: [], enrollments: [], marks: [], attendance: {}, ...over };
}

/* ================= tiny assertion harness ================= */

let failures = 0;

function check(id: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`[verify:results] PASS ${id}`);
  } else {
    failures += 1;
    console.error(`[verify:results] FAIL ${id}: expected ${e}, got ${a}`);
  }
}

function msSince(start: number): number {
  return Date.now() - start;
}

/* ================= T1–T15 ================= */

function t1(): void {
  const subjects = Array.from({ length: 7 }, (_, i) => subject(i + 1));
  const components = subjects.map((s) => component(s));
  const enrolled = student('stu-1', 1);
  const scores = ['85', '85', '85', '85', '85', '75', '85'];
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects,
      components,
      students: [enrolled],
      enrollments: subjects.map((s, i) => ({
        studentId: enrolled.studentId,
        syllabusSubjectId: s.id,
        assignedRole: i === 6 ? 'FOURTH_OPTIONAL' : 'COMPULSORY',
      })),
      marks: components.map((c, i) => mark(enrolled.studentId, subjects[i], c, scores[i])),
    }),
  );
  const sheet = result.marksheets[0];
  check('T1 gpa_without_fourth', sheet.gpaWithoutFourth, '4.83');
  check('T1 final', sheet.finalGpaOrCgpa, '5.00');
}

function t2(): void {
  const phys = subject(1, { fullMarks: '100.00' });
  const cq = component(phys, { id: 'cq', componentCode: 'CQ_WRITTEN', maxRawMarks: '55.00', convertedMaxMarks: '55.00' });
  const mcq = component(phys, { id: 'mcq', componentCode: 'MCQ', maxRawMarks: '25.00', convertedMaxMarks: '25.00', minPassMarks: '8.00', displayOrder: 2 });
  const prac = component(phys, { id: 'prac', componentCode: 'PRACTICAL', maxRawMarks: '20.00', convertedMaxMarks: '20.00', displayOrder: 3 });
  const enrolled = student('stu-1', 1);
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects: [phys],
      components: [cq, mcq, prac],
      students: [enrolled],
      enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: phys.id, assignedRole: 'COMPULSORY' }],
      marks: [mark(enrolled.studentId, phys, cq, '55'), mark(enrolled.studentId, phys, mcq, '7'), mark(enrolled.studentId, phys, prac, '20')],
    }),
  );
  check('T2 fail_reason', result.subjectRows[0].failReason, 'FAILED_MCQ');
  check('T2 grade_point', result.subjectRows[0].gradePoint, '0.00');
}

function t3(): void {
  const first = subject(1, { fullMarks: '70.00', combinedGroupCode: 'BANGLA', combinedGroupName: 'Bangla', passEvaluationMode: 'COMBINED_PAPER_COMPONENTS' });
  const second = subject(2, { fullMarks: '70.00', combinedGroupCode: 'BANGLA', combinedGroupName: 'Bangla', passEvaluationMode: 'COMBINED_PAPER_COMPONENTS' });
  const cq1 = component(first, { id: 'b1', maxRawMarks: '70.00', convertedMaxMarks: '70.00', minPassMarks: '23.00' });
  const cq2 = component(second, { id: 'b2', maxRawMarks: '70.00', convertedMaxMarks: '70.00', minPassMarks: '23.00' });
  const enrolled = student('stu-1', 1);
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects: [first, second],
      components: [cq1, cq2],
      students: [enrolled],
      enrollments: [
        { studentId: enrolled.studentId, syllabusSubjectId: first.id, assignedRole: 'COMPULSORY' },
        { studentId: enrolled.studentId, syllabusSubjectId: second.id, assignedRole: 'COMPULSORY' },
      ],
      marks: [mark(enrolled.studentId, first, cq1, '18'), mark(enrolled.studentId, second, cq2, '30')],
    }),
  );
  const merged = result.subjectRows.find((row) => row.isMergedSummaryRow);
  check('T3 merged passes', merged?.isPassed, true);
  check('T3 merged total', merged?.totalObtainedMarks, '48.00');
}

function t4(): void {
  const courses = [1, 2, 3, 4, 5].map((i) => subject(i, { creditHours: i === 5 ? '2.00' : '4.00' }));
  const components = courses.map((c) => component(c));
  const enrolled = student('stu-1', 1);
  const scores = ['85', '77', '67', '62', '85'];
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale({ scaleType: 'CGPA_4', maxPoint: '4.00', minPassPercentage: '40.00', fourthSubjectDeduction: '0.00' }),
      ranges: NU_4_RANGES,
      subjects: courses,
      components,
      students: [enrolled],
      enrollments: courses.map((c) => ({ studentId: enrolled.studentId, syllabusSubjectId: c.id, assignedRole: 'COMPULSORY' })),
      marks: components.map((c, i) => mark(enrolled.studentId, courses[i], c, scores[i])),
    }),
  );
  check('T4 CGPA', result.marksheets[0].finalGpaOrCgpa, '3.56');
}

function t5(): void {
  const range = resolvePercentageRange(new Decimal('79.5'), BOARD_5_RANGES);
  check('T5 79.5 letter', range?.letterGrade, 'A');
  check('T5 79.5 point', range?.gradePoint, '4.00');

  const sub = subject(1);
  const cq = component(sub);
  const enrolled = student('stu-1', 1);
  const result = buildSnapshots(
    input({
      term: term({ markRoundingMode: 'TWO_DECIMALS' }),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects: [sub],
      components: [cq],
      students: [enrolled],
      enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }],
      marks: [mark(enrolled.studentId, sub, cq, '79.5')],
    }),
  );
  check('T5 engine letter', result.subjectRows[0].letterGrade, 'A');
  check('T5 engine point', result.subjectRows[0].gradePoint, '4.00');
}

function t6(): void {
  const subjects = [subject(1), subject(2)];
  const components = subjects.map((s) => component(s));
  const enrolled = student('stu-1', 1);
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects,
      components,
      students: [enrolled],
      enrollments: [
        { studentId: enrolled.studentId, syllabusSubjectId: subjects[0].id, assignedRole: 'COMPULSORY' },
        { studentId: enrolled.studentId, syllabusSubjectId: subjects[1].id, assignedRole: 'FOURTH_OPTIONAL' },
      ],
      // Compulsory passes (85), the 4th subject fails (20 < 33).
      marks: [mark(enrolled.studentId, subjects[0], components[0], '85'), mark(enrolled.studentId, subjects[1], components[1], '20')],
    }),
  );
  const sheet = result.marksheets[0];
  check('T6 failed_subject_count', sheet.failedSubjectCount, 0);
  check('T6 result_status', sheet.resultStatus, 'PASSED');
}

function t7(): void {
  const sub = subject(1);
  const cq = component(sub);
  const enrolled = student('stu-1', 1);
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects: [sub],
      components: [cq],
      students: [enrolled],
      enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }],
      marks: [mark(enrolled.studentId, sub, cq, '20')],
    }),
  );
  const sheet = result.marksheets[0];
  check('T7 final', sheet.finalGpaOrCgpa, '0.00');
  check('T7 letter', sheet.finalLetterGrade, 'F');
  check('T7 result_status', sheet.resultStatus, 'FAILED');
}

function t8(): void {
  const sub = subject(1);
  const cq = component(sub);
  const enrolled = student('stu-1', 1);
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects: [sub],
      components: [cq],
      students: [enrolled],
      enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }],
      marks: [{ ...mark(enrolled.studentId, sub, cq, '0'), isAbsent: true }],
    }),
  );
  check('T8 fail_reason', result.subjectRows[0].failReason, 'ABSENT');
  check('T8 result_status', result.marksheets[0].resultStatus, 'FAILED');
}

function t9(): void {
  // BEST_N_AVERAGE, N=2, k=3, unequal child maxima (CC-06 normalise-then-scale):
  // f = 16/20 (0.8), 21/30 (0.7), 9/10 (0.9) → top-2 mean = 0.85.
  const fraction = aggregateCt('BEST_N_AVERAGE', 2, [
    { f: new Decimal('16').div('20'), weight: new Decimal('100') },
    { f: new Decimal('21').div('30'), weight: new Decimal('100') },
    { f: new Decimal('9').div('10'), weight: new Decimal('100') },
  ]);
  check('T9 aggregate fraction', fraction?.toFixed(2), '0.85');
  check('T9 scaled to parent max 20', fraction?.mul('20').toFixed(2), '17.00');
  check('T9 k=0 is a blocker, not a silent 0', aggregateCt('BEST_N_AVERAGE', 2, []), null);
}

function t10(): void {
  const subjects = [subject(1), subject(2)];
  const components = subjects.map((s) => component(s));
  const enrolled = student('stu-1', 1);
  const base = {
    term: term(),
    scale: scale(),
    ranges: BOARD_5_RANGES,
    subjects,
    components,
    students: [enrolled],
    enrollments: subjects.map((s) => ({ studentId: enrolled.studentId, syllabusSubjectId: s.id, assignedRole: 'COMPULSORY' })),
    marks: [mark(enrolled.studentId, subjects[0], components[0], '85'), mark(enrolled.studentId, subjects[1], components[1], '75')],
  };
  const first = JSON.stringify(buildSnapshots(input(base)));
  const second = JSON.stringify(buildSnapshots(input(base)));
  check('T10 re-run byte-identical', first === second, true);
  check('T10 stable ids', stableRowId('term-1:stu-1:subject:sub-1') === stableRowId('term-1:stu-1:subject:sub-1'), true);
}

function t11(): void {
  const courses = [1, 2, 3, 4, 5].map((i) => subject(i, { creditHours: '4.00' }));
  const components = courses.map((c) => component(c));
  const enrolled = student('stu-1', 1);
  const scores = ['85', '77', '67', '62', '30'];
  const result = buildSnapshots(
    input({
      term: term({ minCoursesToPromote: 4, minCgpaToPromote: '2.00' }),
      scale: scale({ scaleType: 'CGPA_4', maxPoint: '4.00', minPassPercentage: '40.00', fourthSubjectDeduction: '0.00' }),
      ranges: NU_4_RANGES,
      subjects: courses,
      components,
      students: [enrolled],
      enrollments: courses.map((c) => ({ studentId: enrolled.studentId, syllabusSubjectId: c.id, assignedRole: 'COMPULSORY' })),
      marks: components.map((c, i) => mark(enrolled.studentId, courses[i], c, scores[i])),
    }),
  );
  const sheet = result.marksheets[0];
  check('T11 final', sheet.finalGpaOrCgpa, '2.80');
  check('T11 result_status', sheet.resultStatus, 'PROMOTED_WITH_F');
}

function t12(): void {
  const sub = subject(1);
  const cq = component(sub);
  const enrolled = student('stu-1', 1);
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale({ scaleType: 'DESCRIPTIVE_ONLY', maxPoint: '0.00', minPassPercentage: '33.00' }),
      ranges: [
        { minPercentage: '70', maxPercentage: '100', letterGrade: 'A', gradePoint: '0.00', descriptiveRemark: 'Excellent' },
        { minPercentage: '0', maxPercentage: '69.99', letterGrade: 'F', gradePoint: '0.00', descriptiveRemark: 'Needs work' },
      ],
      subjects: [sub],
      components: [cq],
      students: [enrolled],
      enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }],
      marks: [mark(enrolled.studentId, sub, cq, '75')],
    }),
  );
  check('T12 tier', result.marksheets[0].finalLetterGrade, 'A');
  check('T12 no GPA', result.marksheets[0].finalGpaOrCgpa, '0.00');
}

function t13(): void {
  const sub = subject(1, { fullMarks: '100.00' });
  const cq = component(sub, { id: 'cq', convertedMaxMarks: '70.00', maxRawMarks: '70.00', minPassMarks: '23.00' });
  const prac = component(sub, { id: 'prac', convertedMaxMarks: '30.00', maxRawMarks: '30.00', displayOrder: 2 });
  const enrolled = student('stu-1', 1);
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects: [sub],
      components: [cq, prac],
      students: [enrolled],
      enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }],
      marks: [mark(enrolled.studentId, sub, cq, '60'), { ...mark(enrolled.studentId, sub, prac, '0'), isExempted: true }],
    }),
  );
  check('T13 effective full marks', result.subjectRows[0].fullMarks, '70.00');
  check('T13 passes', result.subjectRows[0].isPassed, true);
}

function t14(): void {
  // Proxy for "100 students × 4 components in one transaction": the pure
  // engine over the same shape, timed against the plan's <300 ms target.
  const subjects = [subject(1), subject(2), subject(3), subject(4)];
  const components = subjects.map((s) => component(s, { id: `cq-${s.id}` }));
  const students = Array.from({ length: 100 }, (_, i) => student(`stu-${i + 1}`, i + 1));
  const start = Date.now();
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects,
      components,
      students,
      enrollments: students.flatMap((s) => subjects.map((sub) => ({ studentId: s.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }))),
      marks: students.flatMap((s) => components.map((c, i) => mark(s.studentId, subjects[i], c, '75'))),
    }),
  );
  const elapsed = msSince(start);
  console.log(`[verify:results] T14 timing: ${result.marksheets.length} marksheets in ${elapsed} ms (plan target <300 ms)`);
  check('T14 rows', result.marksheets.length, 100);
  if (elapsed > 3000) {
    failures += 1;
    console.error(`[verify:results] FAIL T14 timing: ${elapsed} ms exceeds the 10x guardrail`);
  }
}

function t15(): void {
  // Proxy for "500-student tabulation <500 ms": the pure engine over the same
  // shape. Reporting itself is snapshot-only (no recalculation).
  const sub = subject(1);
  const cq = component(sub);
  const students = Array.from({ length: 500 }, (_, i) => student(`stu-${i + 1}`, i + 1));
  const start = Date.now();
  const result = buildSnapshots(
    input({
      term: term(),
      scale: scale(),
      ranges: BOARD_5_RANGES,
      subjects: [sub],
      components: [cq],
      students,
      enrollments: students.map((s) => ({ studentId: s.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' })),
      marks: students.map((s) => mark(s.studentId, sub, cq, '75')),
    }),
  );
  const elapsed = msSince(start);
  console.log(`[verify:results] T15 timing: ${result.marksheets.length} marksheets in ${elapsed} ms (plan target <500 ms)`);
  check('T15 rows', result.marksheets.length, 500);
  if (elapsed > 5000) {
    failures += 1;
    console.error(`[verify:results] FAIL T15 timing: ${elapsed} ms exceeds the 10x guardrail`);
  }
}

async function main(): Promise<void> {
  t1();
  t2();
  t3();
  t4();
  t5();
  t6();
  t7();
  t8();
  t9();
  t10();
  t11();
  t12();
  t13();
  t14();
  t15();
  if (failures > 0) {
    console.error(`[verify:results] FAILED with ${failures} failure(s)`);
    process.exit(1);
  }
  console.log('[verify:results] all T1–T15 checks passed');
}

main().catch((err) => {
  console.error('[verify:results] FAILED:', err);
  process.exit(1);
});
