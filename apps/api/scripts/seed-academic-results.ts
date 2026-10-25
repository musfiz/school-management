/**
 * Seed the Academic Result Engine's Bangladesh master data (Phase 1).
 *
 * docs/RESULT_ENGINE_EXECUTION_PLAN.md §PHASE 1 — idempotent seeder keyed by
 * name/email: re-running never duplicates rows.
 *
 * Seeds:
 *   - 3 grading scales (+ their percentage→letter/grade-point ranges):
 *       NCTB & Madrasah Board 5.00, NU/IAU 4.00, NCTB Primary 4-Tier
 *   - the standard NU Honours 5-mark attendance slab
 *   - an `exam@school.com` exam-controller user (AD-9)
 *
 * Run: `pnpm --filter api run seed:results`
 *
 * The grading ranges intentionally store `max_percentage` informationally: the
 * engine resolves a value to the row with the greatest `min_percentage <= value`
 * (CC-01, gap-proof for decimals like 79.5), so every band must start at `0` and
 * thresholds must be strictly increasing.
 */
import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';

interface RangeSeed {
  min: number;
  max: number;
  letter: string;
  point: number;
  remark?: string;
}

interface ScaleSeed {
  name: string;
  scaleType: 'GPA_5' | 'CGPA_4' | 'DESCRIPTIVE_ONLY';
  maxPoint: number;
  minPassPoint: number;
  minPassPercentage: number;
  fourthSubjectDeduction: number;
  ranges: RangeSeed[];
}

/** NCTB & Madrasah Board 5.00 scale (SSC/Dakhil/HSC/Alim). */
const BOARD_5_SCALE: ScaleSeed = {
  name: 'NCTB & Madrasah Board 5.00 Scale',
  scaleType: 'GPA_5',
  maxPoint: 5.0,
  minPassPoint: 1.0,
  minPassPercentage: 33.0,
  fourthSubjectDeduction: 2.0,
  ranges: [
    { min: 80, max: 100, letter: 'A+', point: 5.0, remark: 'Outstanding' },
    { min: 70, max: 79.99, letter: 'A', point: 4.0, remark: 'Excellent' },
    { min: 60, max: 69.99, letter: 'A-', point: 3.5, remark: 'Very good' },
    { min: 50, max: 59.99, letter: 'B', point: 3.0, remark: 'Good' },
    { min: 40, max: 49.99, letter: 'C', point: 2.0, remark: 'Satisfactory' },
    { min: 33, max: 39.99, letter: 'D', point: 1.0, remark: 'Pass' },
    { min: 0, max: 32.99, letter: 'F', point: 0.0, remark: 'Fail' },
  ],
};

/** National University / Islamic Arabic University 4.00 CGPA scale. */
const NU_4_SCALE: ScaleSeed = {
  name: 'National University (NU) & IAU 4.00 Scale',
  scaleType: 'CGPA_4',
  maxPoint: 4.0,
  minPassPoint: 2.0,
  minPassPercentage: 40.0,
  fourthSubjectDeduction: 0.0,
  ranges: [
    { min: 80, max: 100, letter: 'A+', point: 4.0, remark: 'Outstanding' },
    { min: 75, max: 79.99, letter: 'A', point: 3.75, remark: 'Excellent' },
    { min: 70, max: 74.99, letter: 'A-', point: 3.5, remark: 'Very good' },
    { min: 65, max: 69.99, letter: 'B+', point: 3.25, remark: 'Good' },
    { min: 60, max: 64.99, letter: 'B', point: 3.0, remark: 'Above average' },
    { min: 55, max: 59.99, letter: 'B-', point: 2.75, remark: 'Average' },
    { min: 50, max: 54.99, letter: 'C+', point: 2.5, remark: 'Below average' },
    { min: 45, max: 49.99, letter: 'C', point: 2.25, remark: 'Pass' },
    { min: 40, max: 44.99, letter: 'D', point: 2.0, remark: 'Lowest pass' },
    { min: 0, max: 39.99, letter: 'F', point: 0.0, remark: 'Fail' },
  ],
};

/** NCTB Primary 4-tier descriptive scale (Pre-Play to Class 5). */
const PRIMARY_4_TIER_SCALE: ScaleSeed = {
  name: 'NCTB Primary 4-Tier Scale',
  scaleType: 'DESCRIPTIVE_ONLY',
  maxPoint: 4.0,
  minPassPoint: 0.0,
  minPassPercentage: 40.0,
  fourthSubjectDeduction: 0.0,
  ranges: [
    { min: 80, max: 100, letter: 'A', point: 0.0, remark: 'Outstanding' },
    { min: 60, max: 79.99, letter: 'B', point: 0.0, remark: 'Good' },
    { min: 40, max: 59.99, letter: 'C', point: 0.0, remark: 'Satisfactory' },
    { min: 0, max: 39.99, letter: 'D', point: 0.0, remark: 'Needs improvement' },
  ],
};

const SCALES: ScaleSeed[] = [BOARD_5_SCALE, NU_4_SCALE, PRIMARY_4_TIER_SCALE];

interface SlabSeed {
  name: string;
  min: number;
  max: number;
  marks: number;
}

/** Standard NU Honours 5-mark attendance slab. */
const ATTENDANCE_SLABS: SlabSeed[] = [
  { name: 'NU Honours 5-Mark Attendance Slab', min: 90, max: 100, marks: 5 },
  { name: 'NU Honours 5-Mark Attendance Slab', min: 85, max: 89.99, marks: 4 },
  { name: 'NU Honours 5-Mark Attendance Slab', min: 80, max: 84.99, marks: 3 },
  { name: 'NU Honours 5-Mark Attendance Slab', min: 75, max: 79.99, marks: 2 },
  { name: 'NU Honours 5-Mark Attendance Slab', min: 0, max: 74.99, marks: 0 },
];

const EXAM_CONTROLLER = {
  name: 'Exam Controller',
  email: 'exam@school.com',
  password: 'Exam@123',
};

async function seedGradingScales(prisma: PrismaService): Promise<void> {
  for (const scale of SCALES) {
    const existing = await prisma.gradingScales.findFirst({ where: { name: scale.name } });
    if (existing) {
      console.log(`[seed:results] grading scale already present: ${scale.name}`);
      continue;
    }
    await prisma.gradingScales.create({
      data: {
        name: scale.name,
        scaleType: scale.scaleType,
        maxPoint: scale.maxPoint,
        minPassPoint: scale.minPassPoint,
        minPassPercentage: scale.minPassPercentage,
        fourthSubjectDeduction: scale.fourthSubjectDeduction,
        gradingScaleRanges: {
          create: scale.ranges.map((r) => ({
            minPercentage: r.min,
            maxPercentage: r.max,
            letterGrade: r.letter,
            gradePoint: r.point,
            descriptiveRemark: r.remark ?? null,
          })),
        },
      },
    });
    console.log(`[seed:results] created grading scale: ${scale.name} (${scale.ranges.length} ranges)`);
  }
}

async function seedAttendanceSlabs(prisma: PrismaService): Promise<void> {
  for (const slab of ATTENDANCE_SLABS) {
    const existing = await prisma.attendanceMarkSlabs.findFirst({
      where: { name: slab.name, minAttendancePct: slab.min },
    });
    if (existing) {
      console.log(`[seed:results] attendance slab already present: ${slab.name} @ ${slab.min}%`);
      continue;
    }
    await prisma.attendanceMarkSlabs.create({
      data: {
        name: slab.name,
        minAttendancePct: slab.min,
        maxAttendancePct: slab.max,
        awardedMarks: slab.marks,
      },
    });
    console.log(`[seed:results] created attendance slab: ${slab.name} @ ${slab.min}%`);
  }
}

async function seedExamController(prisma: PrismaService): Promise<void> {
  const existing = await prisma.users.findUnique({ where: { email: EXAM_CONTROLLER.email } });
  if (existing) {
    console.log(`[seed:results] user already present: ${EXAM_CONTROLLER.email}`);
    return;
  }
  // The password is hashed centrally by the Prisma extension (AD-P8).
  await prisma.users.create({
    data: {
      name: EXAM_CONTROLLER.name,
      email: EXAM_CONTROLLER.email,
      password: EXAM_CONTROLLER.password,
      role: 'exam_controller',
      isActive: true,
      isVerified: true,
    },
  });
  console.log(
    `[seed:results] created exam-controller user: ${EXAM_CONTROLLER.email} (password: ${EXAM_CONTROLLER.password})`,
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    await seedGradingScales(prisma);
    await seedAttendanceSlabs(prisma);
    await seedExamController(prisma);
    console.log('[seed:results] done');
  } finally {
    await prisma.$disconnect();
  }
}

export { main as main };

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed:results] FAILED:', err);
    process.exit(1);
  });
}
