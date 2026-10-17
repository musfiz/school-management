import { buildSnapshots } from './result-calculation.service';
import { stableRowId } from '../common/stable-id.util';
import type {
  EngineComponent,
  EngineInput,
  EngineMark,
  EngineRange,
  EngineScale,
  EngineStudent,
  EngineSubject,
  EngineTerm,
} from '../common/mapper.util';

/* ================= fixtures ================= */

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
  return {
    subjects: [],
    components: [],
    students: [],
    enrollments: [],
    marks: [],
    attendance: {},
    ...over,
  };
}

/* ================= acceptance cases (§5) ================= */

describe('ResultCalculationEngine (§5 acceptance)', () => {
  it('CC-07/CC-08/CC-09: 5×A+ + 1×A + 4th A+ ⇒ gpa_without_fourth 4.83, final 5.00', () => {
    const subjects = Array.from({ length: 7 }, (_, i) => subject(i + 1));
    const components = subjects.map((s) => component(s));
    const enrolled = student('stu-1', 1);
    // Five A+ and one A compulsory + an A+ 4th subject.
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
    expect(sheet.totalCompulsorySubjects).toBe(6);
    expect(sheet.gpaWithoutFourth).toBe('4.83');
    expect(sheet.finalGpaOrCgpa).toBe('5.00');
    expect(sheet.fourthSubjectBonusGp).toBe('3.00');
    expect(sheet.marksWithoutFourth).toBe('500.00');
    expect(sheet.marksWithFourth).toBe('585.00');
    expect(sheet.resultStatus).toBe('PASSED');

    const fourth = result.subjectRows.find((row) => row.assignedRole === 'FOURTH_OPTIONAL');
    expect(fourth?.gradePoint).toBe('5.00');
    expect(fourth?.effectiveGpForGpa).toBe('3.00');
  });

  it('CC-04: a single failing MCQ forces GP 0.00 / FAILED_MCQ even when the total passes', () => {
    const phys = subject(1, { fullMarks: '100.00' });
    const cq = component(phys, { id: 'cq', componentCode: 'CQ_WRITTEN', maxRawMarks: '55.00', convertedMaxMarks: '55.00' });
    const mcq = component(phys, {
      id: 'mcq',
      componentCode: 'MCQ',
      maxRawMarks: '25.00',
      convertedMaxMarks: '25.00',
      minPassMarks: '8.00',
      displayOrder: 2,
    });
    const prac = component(phys, {
      id: 'prac',
      componentCode: 'PRACTICAL',
      maxRawMarks: '20.00',
      convertedMaxMarks: '20.00',
      displayOrder: 3,
    });
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
        // 55 + 7 + 20 = 82 % (comfortably passing) but MCQ 7 < 8.
        marks: [mark(enrolled.studentId, phys, cq, '55'), mark(enrolled.studentId, phys, mcq, '7'), mark(enrolled.studentId, phys, prac, '20')],
      }),
    );

    const row = result.subjectRows[0];
    expect(row.totalObtainedMarks).toBe('82.00');
    expect(row.isPassed).toBe(false);
    expect(row.failReason).toBe('FAILED_MCQ');
    expect(row.gradePoint).toBe('0.00');
    expect(row.letterGrade).toBe('F');

    expect(result.marksheets[0].failedSubjectCount).toBe(1);
    expect(result.marksheets[0].finalGpaOrCgpa).toBe('0.00');
    expect(result.marksheets[0].resultStatus).toBe('FAILED');
  });

  it('CC-05: 18/70 + 30/70 passes via COMBINED_PAPER_COMPONENTS (Σ 48 ≥ 46)', () => {
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

    const papers = result.subjectRows.filter((row) => !row.isMergedSummaryRow);
    const merged = result.subjectRows.find((row) => row.isMergedSummaryRow);

    // Paper 1 fails on its own (25.71 % < 33 %) …
    expect(papers[0].isPassed).toBe(false);
    // … but the merged 1st+2nd paper row passes via the combined component sum.
    expect(merged?.fullMarks).toBe('140.00');
    expect(merged?.totalObtainedMarks).toBe('48.00');
    expect(merged?.percentageMarks).toBe('34.29');
    expect(merged?.isPassed).toBe(true);
    expect(merged?.failReason).toBeNull();
    expect(merged?.letterGrade).toBe('D');

    // The merged row is the GPA authority; the two papers are display-only.
    expect(result.marksheets[0].totalCompulsorySubjects).toBe(1);
    expect(result.marksheets[0].finalGpaOrCgpa).toBe('1.00');
  });

  it('CC-10: four 4-credit courses + one 2-credit lab ⇒ CGPA exactly 3.56', () => {
    const courses = [1, 2, 3, 4, 5].map((i) => subject(i, { creditHours: i === 5 ? '2.00' : '4.00' }));
    const components = courses.map((c) => component(c));
    const enrolled = student('stu-1', 1);
    // GP 4.00, 3.75, 3.25, 3.00, 4.00 → (16 + 15 + 13 + 12 + 8) / 18 = 3.5555… ⇒ 3.56
    const scores = ['85', '77', '67', '62', '85'];

    const result = buildSnapshots(
      input({
        term: term(),
        scale: scale({ scaleType: 'CGPA_4', maxPoint: '4.00', minPassPercentage: '40.00', fourthSubjectDeduction: '0.00' }),
        ranges: NU_4_RANGES,
        subjects: courses,
        components,
        students: [enrolled],
        enrollments: courses.map((c) => ({
          studentId: enrolled.studentId,
          syllabusSubjectId: c.id,
          assignedRole: 'COMPULSORY',
        })),
        marks: components.map((c, i) => mark(enrolled.studentId, courses[i], c, scores[i])),
      }),
    );

    const sheet = result.marksheets[0];
    expect(sheet.totalCreditsAttempted).toBe('18.00');
    expect(sheet.totalCreditsEarned).toBe('18.00');
    expect(sheet.finalGpaOrCgpa).toBe('3.56');
    expect(sheet.gpaWithoutFourth).toBe('3.56');
    expect(sheet.finalLetterGrade).toBe('A-');
    expect(sheet.resultStatus).toBe('PASSED');
  });
});

/* ================= corner cases ================= */

describe('ResultCalculationEngine corner cases', () => {
  it('CC-02: rounds the subject total before deriving the percentage', () => {
    const sub = subject(1);
    const cq = component(sub);
    const enrolled = student('stu-1', 1);

    const result = buildSnapshots(
      input({
        term: term({ markRoundingMode: 'HALF_UP_INTEGER' }),
        scale: scale(),
        ranges: BOARD_5_RANGES,
        subjects: [sub],
        components: [cq],
        students: [enrolled],
        enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }],
        marks: [mark(enrolled.studentId, sub, cq, '47.50')],
      }),
    );

    expect(result.subjectRows[0].totalObtainedMarks).toBe('48.00');
    expect(result.subjectRows[0].percentageMarks).toBe('48.00');
  });

  it('CC-03: exempted components leave the max and pass check; absent-all ⇒ ABSENT', () => {
    const sub = subject(1, { fullMarks: '100.00' });
    const cq = component(sub, { id: 'cq', convertedMaxMarks: '70.00', maxRawMarks: '70.00', minPassMarks: '23.00' });
    const prac = component(sub, { id: 'prac', convertedMaxMarks: '30.00', maxRawMarks: '30.00', displayOrder: 2 });
    const enrolled = student('stu-1', 1);

    const exempted = buildSnapshots(
      input({
        term: term(),
        scale: scale(),
        ranges: BOARD_5_RANGES,
        subjects: [sub],
        components: [cq, prac],
        students: [enrolled],
        enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }],
        marks: [
          mark(enrolled.studentId, sub, cq, '60'),
          { ...mark(enrolled.studentId, sub, prac, '0'), isExempted: true },
        ],
      }),
    );

    // Effective full marks drop 100 → 70, so 60 marks is 85.71 % (A+), not 60 %.
    expect(exempted.subjectRows[0].fullMarks).toBe('70.00');
    expect(exempted.subjectRows[0].percentageMarks).toBe('85.71');
    expect(exempted.subjectRows[0].isPassed).toBe(true);

    const absent = buildSnapshots(
      input({
        term: term(),
        scale: scale(),
        ranges: BOARD_5_RANGES,
        subjects: [sub],
        components: [cq, prac],
        students: [enrolled],
        enrollments: [{ studentId: enrolled.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' }],
        marks: [
          { ...mark(enrolled.studentId, sub, cq, '0'), isAbsent: true },
          { ...mark(enrolled.studentId, sub, prac, '0'), isAbsent: true },
        ],
      }),
    );

    expect(absent.subjectRows[0].failReason).toBe('ABSENT');
    expect(absent.subjectRows[0].isPassed).toBe(false);
  });

  it('CC-13: merit ranking is deterministic and breaks ties by roll', () => {
    const sub = subject(1);
    const cq = component(sub);
    const students = [student('stu-1', 2), student('stu-2', 1), student('stu-3', 3)];

    const result = buildSnapshots(
      input({
        term: term(),
        scale: scale(),
        ranges: BOARD_5_RANGES,
        subjects: [sub],
        components: [cq],
        students,
        enrollments: students.map((s) => ({ studentId: s.studentId, syllabusSubjectId: sub.id, assignedRole: 'COMPULSORY' })),
        // stu-1 and stu-2 tie on 85; stu-2 has the lower roll and must rank first.
        marks: [
          mark('stu-1', sub, cq, '85'),
          mark('stu-2', sub, cq, '85'),
          mark('stu-3', sub, cq, '40'),
        ],
      }),
    );

    const byStudent = new Map(result.marksheets.map((sheet) => [sheet.studentId, sheet]));
    expect(byStudent.get('stu-2')?.meritPositionSection).toBe(1);
    expect(byStudent.get('stu-1')?.meritPositionSection).toBe(2);
    expect(byStudent.get('stu-3')?.meritPositionSection).toBe(3);
    expect(result.subjectRows[0].highestMarksInClass).toBe('85.00');
  });

  it('CC-12: descriptive-only scales resolve a tier without GPA arithmetic', () => {
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

    expect(result.marksheets[0].finalGpaOrCgpa).toBe('0.00');
    expect(result.marksheets[0].finalLetterGrade).toBe('A');
    expect(result.marksheets[0].resultStatus).toBe('PASSED');
  });

  it('CC-11: 1st/2nd papers merge into ONE authority row (marksheet rowSpan contract)', () => {
    // Regression: the merged summary row is the GPA authority; it must persist
    // exactly once per student/group and must never be a paper row.
    const paper1 = subject(1, {
      subjectCode: 'BNG1',
      combinedGroupCode: 'BNG12',
      combinedGroupName: 'Bangla 1st & 2nd Paper',
      passEvaluationMode: 'COMBINED_PAPER_COMPONENTS',
      displayOrder: 1,
    });
    const paper2 = subject(2, {
      subjectCode: 'BNG2',
      combinedGroupCode: 'BNG12',
      combinedGroupName: 'Bangla 1st & 2nd Paper',
      passEvaluationMode: 'COMBINED_PAPER_COMPONENTS',
      displayOrder: 2,
    });
    const cq1 = component(paper1, { id: 'cq-bng1' });
    const cq2 = component(paper2, { id: 'cq-bng2' });
    const enrolled = student('stu-1', 1);

    const result = buildSnapshots(
      input({
        term: term(),
        scale: scale(),
        ranges: BOARD_5_RANGES,
        subjects: [paper1, paper2],
        components: [cq1, cq2],
        students: [enrolled],
        enrollments: [
          { studentId: enrolled.studentId, syllabusSubjectId: paper1.id, assignedRole: 'COMPULSORY' },
          { studentId: enrolled.studentId, syllabusSubjectId: paper2.id, assignedRole: 'COMPULSORY' },
        ],
        marks: [
          mark(enrolled.studentId, paper1, cq1, '60'),
          mark(enrolled.studentId, paper2, cq2, '40'),
        ],
      }),
    );

    // Both papers persist as their own rows, each carrying the group code.
    const papers = result.subjectRows.filter((row) => !row.isMergedSummaryRow);
    expect(papers).toHaveLength(2);
    expect(papers.map((row) => row.totalObtainedMarks).sort()).toEqual(['40.00', '60.00']);
    expect(papers.every((row) => row.combinedGroupCode === 'BNG12')).toBe(true);

    // Exactly one merged authority row: 60 + 40 over a combined 200 = 50% -> B (3.00).
    const mergedRows = result.subjectRows.filter((row) => row.isMergedSummaryRow);
    expect(mergedRows).toHaveLength(1);
    const merged = mergedRows[0];
    expect(merged.syllabusSubjectId).toBeNull();
    expect(merged.combinedGroupCode).toBe('BNG12');
    expect(merged.totalObtainedMarks).toBe('100.00');
    expect(merged.fullMarks).toBe('200.00');
    expect(merged.percentageMarks).toBe('50.00');
    expect(merged.letterGrade).toBe('B');
    expect(merged.gradePoint).toBe('3.00');

    // Averaging the two papers instead would give 2.75 - proof the merged row drives the GPA.
    expect(result.marksheets[0].finalGpaOrCgpa).toBe('3.00');
    expect(result.marksheets[0].resultStatus).toBe('PASSED');
  });
});

/* ================= test-matrix gaps (T5 / T10 / T11) ================= */

describe('ResultCalculationEngine test-matrix gaps', () => {
  it('T5: 79.5 % resolves to A (4.00) — decimal bands have no gaps (CC-01)', () => {
    const sub = subject(1);
    const cq = component(sub);
    const enrolled = student('stu-1', 1);

    const result = buildSnapshots(
      input({
        // TWO_DECIMALS keeps 79.5 intact; the default HALF_UP_INTEGER would
        // round the total to 80 first (CC-02) and that A+ is correct too.
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

    expect(result.subjectRows[0].totalObtainedMarks).toBe('79.50');
    expect(result.subjectRows[0].percentageMarks).toBe('79.50');
    expect(result.subjectRows[0].isPassed).toBe(true);
    expect(result.subjectRows[0].letterGrade).toBe('A');
    expect(result.subjectRows[0].gradePoint).toBe('4.00');
  });

  it('T10: re-running the engine on the same input yields byte-identical snapshots', () => {
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
      enrollments: subjects.map((s) => ({
        studentId: enrolled.studentId,
        syllabusSubjectId: s.id,
        assignedRole: 'COMPULSORY',
      })),
      marks: [mark(enrolled.studentId, subjects[0], components[0], '85'), mark(enrolled.studentId, subjects[1], components[1], '75')],
    };

    const first = buildSnapshots(input(base));
    const second = buildSnapshots(input(base));

    // Pure-function determinism: the same input always produces the same rows.
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));

    // Persisted ids are content-derived (CC-15), so a re-run re-inserts the
    // same keys instead of minting new UUIDs — and the job runner reuses the
    // term's single job row (one active job per term, AD-2/CC-15).
    expect(stableRowId('term-1:stu-1:subject:sub-1')).toBe(stableRowId('term-1:stu-1:subject:sub-1'));
  });

  it('T11: meeting min_courses_to_promote with 1 F on the 4.00 scale ⇒ PROMOTED_WITH_F (CC-10)', () => {
    const courses = [1, 2, 3, 4, 5].map((i) => subject(i, { creditHours: '4.00' }));
    const components = courses.map((c) => component(c));
    const enrolled = student('stu-1', 1);
    // GP 4.00 + 3.75 + 3.25 + 3.00 + 0.00 over 20 credits = 2.80 (≥ 2.00),
    // with 4 passed courses (≥ 4) — conditional promotion, not a fail.
    const scores = ['85', '77', '67', '62', '30'];

    const result = buildSnapshots(
      input({
        term: term({ minCoursesToPromote: 4, minCgpaToPromote: '2.00' }),
        scale: scale({ scaleType: 'CGPA_4', maxPoint: '4.00', minPassPercentage: '40.00', fourthSubjectDeduction: '0.00' }),
        ranges: NU_4_RANGES,
        subjects: courses,
        components,
        students: [enrolled],
        enrollments: courses.map((c) => ({
          studentId: enrolled.studentId,
          syllabusSubjectId: c.id,
          assignedRole: 'COMPULSORY',
        })),
        marks: components.map((c, i) => mark(enrolled.studentId, courses[i], c, scores[i])),
      }),
    );

    const sheet = result.marksheets[0];
    expect(sheet.totalCreditsAttempted).toBe('20.00');
    expect(sheet.totalCreditsEarned).toBe('16.00');
    expect(sheet.finalGpaOrCgpa).toBe('2.80');
    expect(sheet.failedSubjectCount).toBe(1);
    expect(sheet.resultStatus).toBe('PROMOTED_WITH_F');
  });
});
