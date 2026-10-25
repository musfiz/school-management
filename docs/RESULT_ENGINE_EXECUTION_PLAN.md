# Result Engine — Step-by-Step Execution Plan

> **Derived from:** `docs/RESULT_ENGINE_PLAN.md` (the source spec)
> **Date:** 2026-10-16 (Prisma as-built rewrite: 2026-10-17, see `docs/PRISMA_MIGRATION_PLAN.md` §11)
> **Status:** ✅ COMPLETE — all 7 phases delivered Prisma-native; §9 questions resolved except Q10 (follow-up).

This document converts the source spec into an executable plan that matches the
**actual** repository. It is intentionally opinionated about the parts of the
source spec that do not survive contact with the codebase (ID types, folder
layout, route groups, missing dependencies) and it enumerates the edge cases the
engine must handle so results are correct for every level from Pre-Play to
Kamil/Masters.

> **Superseded content:** the 2026-10-16 revision of this doc described a
> TypeORM implementation (`src/database/data-source.ts`, `src/database/entities/`,
> `src/database/migrations/`). The repo migrated to Prisma
> (`docs/PRISMA_MIGRATION_PLAN.md`) **before** this engine was built, so the
> engine was built Prisma-native from the start. All TypeORM paths below have
> been replaced with the Prisma reality; the calculation rules (§5) are
> unchanged.

---

## 1. Ground truth — what already exists

Verified by reading the repo, not the plan.

### 1.1 Backend (`apps/api`)

| Area | Reality | File(s) |
| --- | --- | --- |
| Framework | NestJS 11, CommonJS, `strict` **off** | `apps/api/package.json`, `tsconfig.json` |
| ORM | Prisma 6, MySQL/MariaDB (`@prisma/adapter-mariadb`) | `apps/api/prisma/schema.prisma` |
| Data model | Prisma models in `schema.prisma`; `PrismaService` is global (no per-module import) | `src/prisma/prisma.service.ts`, `src/prisma/prisma.module.ts` |
| Migrations | `prisma migrate dev` (local) / `deploy` (servers); SQL in `prisma/migrations/` | `apps/api/prisma/migrations/` |
| PK convention | UUID `CHAR(36)`, `@default(dbgenerated("(uuid())"))` | `schema.prisma`, migration SQL |
| Decimal math | `decimal.js` | `apps/api/package.json` |
| Roles | `UserRole` enum includes `exam_controller` (AD-9 done); `@Roles()` + `RolesGuard` exist | `src/database/entities/user-role.enum.ts`, `src/common/guards/roles.guard.ts` |
| Auth | Global `JwtAuthGuard` via `APP_GUARD`; `@Public()` opts out | `src/app.module.ts` |
| Seeds | Manually-run scripts in `apps/api/scripts/`, each wired as a `package.json` script | `scripts/seed-academic-results.ts`, `apps/api/package.json` (`seed:results`, `verify:results`) |
| Queue | **No `@nestjs/bullmq`, no Redis, no `@nestjs/schedule`** | `apps/api/package.json` |
| Tests | Jest 30 (`pnpm --filter api test`); 124 tests green | `src/**/*.spec.ts` |

### 1.2 Subjects tables already built (Result Plan §2)

Prisma models already exist (created by the admissions work, shared — never duplicated):

- `AcademicSubjects` → `academic_subjects`
- `ClassSyllabusSubjects` → `class_syllabus_subjects`
- `StudentSubjectEnrollments` → `student_subject_enrollments`

So **3 of the 11 source tables exist**; the engine adds the remaining 8 + 3 support tables (§4).

### 1.3 Frontend (`apps/web`)

| Area | Reality | File(s) |
| --- | --- | --- |
| Route base | **`(protected)/admin/...`**, NOT `(dashboard)/...` | `apps/web/src/app/(protected)/admin/` |
| Page pattern | `page.tsx` = session guard + `*View.tsx` client component | `.../admin/academic-results/*/page.tsx` |
| API calls | Same-origin `apiFetch` → catch-all proxy route → NestJS | `src/lib/api.ts`, `src/app/api/academic-results/[...path]/route.ts` |
| Client lib | One function per API route, `SearchSelect`-ready options, `fmt2` formatting | `src/lib/academic-results.ts` |
| Table lib | `@tanstack/react-table ^8.21.3` | `apps/web/package.json` |
| UI kit | `DashPageHeader`, `DashCard`, `AdminPageLoader`, `SearchSelect`, `DatePickerField`, `PrintMenu` | `src/components/dashboard/`, `src/components/ui/` |
| Nav | The full "Exam & Result Engine" nav tree points at the delivered routes | `src/lib/nav-config.ts` |
| Existing stub | `/admin/results` placeholder + mock public lookup (Q10 follow-up, untouched) | `admin/results/ResultsView.tsx`, `components/ResultLookup.tsx` |

### 1.4 Dependencies the source plan silently assumes

| Assumed | Status | Resolution |
| --- | --- | --- |
| Academic calendar (sessions, classes, sections, shifts, groups) | ❌ none — IDs are opaque UUIDs | UI derives options from existing data via `GET /academic-results/lookups/*` (**AD-3**, delivered) |
| Attendance module | ❌ none | `AUTO_FROM_ATTENDANCE` reads `student_attendance_summaries` via `ResultAttendanceAdapter` (**AD-4**, delivered) |
| BullMQ + Redis | ❌ not installed | In-DB job table + in-process runner (**AD-2**, delivered) |
| `exam_controller` role | ✅ added | Migration alters `users.role`; seeded `exam@school.com` user (**AD-9**, delivered) |

---

## 2. Corrections to the source plan

Every row is a place the source spec would mislead a build agent.

| # | Source plan says | Repo reality / as-built | Correction |
| --- | --- | --- | --- |
| C1 | `BIGINT AUTO_INCREMENT` PKs | UUID `CHAR(36)` everywhere | Prisma `@id @default(dbgenerated("(uuid())")) @db.Char(36)`. |
| C2 | Backend dir `src/modules/academic-results/` | Module dirs are `src/<module>/` | **`apps/api/src/academic-results/`**. |
| C3 | Frontend `(dashboard)/academic-results/` | Routes are `(protected)/admin/<module>/` | **`apps/web/src/app/(protected)/admin/academic-results/`** (matches `nav-config.ts`). |
| C4 | "Prisma or TypeORM" | Prisma only | Prisma models + generated client everywhere; `DECIMAL` columns arrive as **strings** at runtime — mappers coerce with `String()` (CC-20). |
| C5 | `@nestjs/bullmq` worker | Not installed, no Redis | In-DB job table + in-process runner (**AD-2**). |
| C6 | 11 tables | 3 already exist | Created the **8 missing** tables + 3 support tables (§4) in `20261017135221_create_result_engine_tables`. |
| C7 | Seed `80-100 A+`, `70-79 A`, … (closed integer bands) | Marks can be decimal (`DECIMAL(8,2)`) | Bands have gaps at `79.5`. Use **greatest-`min_percentage`-≤ value** lookup (CC-01). `max_percentage` is informational. |
| C8 | "verify `T ≥` Scale Min Pass **Percentage**" but scale stores `min_pass_point` (a grade point) | Type mismatch | Explicit **`min_pass_percentage`** column on `grading_scales` (AD-6). |
| C9 | Stage 7 "25% Term1 + 25% Term2 + 50% Final" but only a single `annual_weight_pct` column exists | No per-child weight storage | **`exam_term_weights`** table (AD-7). |
| C10 | Rule 1 aggregates child marks "scaled to converted_max_marks" | Each CT child can have a different max | **Normalise-then-scale** formula (CC-06 / AD-8), implemented in `common/ct-aggregation.util.ts`. |
| C11 | `AUTO_FROM_SUB_EXAMS` component pulls child marks | No link saying *which* child component | **`source_component_code`** column on `exam_subject_components`. |
| C12 | Merit tie-break "previous_roll" | No such column | Use `student_enrollments.class_roll_no` for the session/class. |
| C13 | Multi-tenant roles `EXAM_CONTROLLER` | Enum lacked it | `users.role` ENUM extended via the engine migration; `EXAM_CONTROLLER` added to `UserRole`; `exam@school.com` seeded (AD-9). |
| C14 | Attendance component automatic | No attendance source | Adapter + `student_attendance_summaries` manual/CSV table (AD-4). |
| C15 | Web calls `/api/...` | Needs a proxy route per module | `apps/web/src/app/api/academic-results/[...path]/route.ts` (copy of the accounting proxy; forwards JSON **and** multipart import uploads). |
| C16 | `student_subject_results.syllabus_subject_id` NULLable for merged rows + plan's plain unique | MySQL allows many NULLs; paper rows and the merged row **share** `combined_group_code` | As-built: `uq_result_subject (exam_term_id, student_id, syllabus_subject_id)` guards paper rows; the planned `uq_result_merged` was **replaced by a plain lookup index** (`20261017153015_fix_merged_row_unique_index`) because papers and their merged row collide on it. One-merged-row-per-group is guaranteed by the engine (Map collapse) + single-transaction persist (CC-14/CC-15). |

---

## 3. Architecture decisions (AD-n)

All sign-off questions from §9 are resolved; the chosen option is recorded as built.

**AD-1 — New module is `academic-results`; Prisma is the only persistence layer.**
`apps/api/src/academic-results/` holds `syllabus-config/`, `lookups/`,
`exam-setup/` (+ `validators/`), `marks-entry/`, `calculation-engine/`,
`reports-transcripts/`, `common/`. One `academic-results.module.ts` registers
everything. Entities are Prisma models in `apps/api/prisma/schema.prisma` —
there is no TypeORM entity dir for new tables.
*Rejected:* per-feature entity folders; re-introducing TypeORM.

**AD-2 — Background calculation uses an in-DB job table + async in-process runner (no Redis).**
`result_generation_jobs` + `ResultJobRunnerService`: work starts after the HTTP
request returns (`setImmediate`); the pure `buildSnapshots` pipeline takes an
`onProgress` callback so it can be lifted to BullMQ later with zero algorithm
changes. Guarantees: one active job per `exam_term` (conditional check +
single reused job row per term), idempotent delete-and-recompute inside one
transaction with stable content-derived ids, progress `0→100`, rollback on error.
*Rejected:* installing Redis+BullMQ — new infra for single-node generation.

**AD-3 — Academic calendar stays external/opaque; UI derives options from existing data.**
`academic_session_id`, `class_or_dept_id`, `section_or_batch_id`, `shift_id` are
opaque UUIDs. Result Engine never joins them. Delivered as
`GET /academic-results/lookups/sessions|classes|sections` plus a combined
`GET /academic-results/lookups/scope` (`?academicSessionId=&classOrDeptId=`),
returning **distinct values already present** in `class_syllabus_subjects` /
`student_subject_enrollments` / `student_enrollments` in the admissions
`{ value, label, count }` shape. The web `getScopeFilterOptions()` calls the
new scope endpoint and falls back to the admissions `filter-options` endpoint
for older API deployments.
*Rejected:* building the calendar module inside this feature — scope explosion.

**AD-4 — Attendance is an adapter with a manual-override table.**
`student_attendance_summaries(exam_term_id, student_id,
attendance_percentage, source, updated_at)` + `ResultAttendanceAdapter`
(`getAttendancePct`, `awardedMarksFor`). Today it reads this table (manual entry
/ CSV import); a future attendance module implements the same interface.
`AUTO_FROM_ATTENDANCE` components map pct→marks through
`attendance_mark_slabs`. *Rejected:* skipping attendance — NU/IAU CGPA requires it.

**AD-5 — Deterministic grade lookup, gap-proof.**
`resolvePercentageRange` / `resolveGpaRange` return the row with the greatest
`min_*` that is `<= value`. Validation requires the lowest threshold to be `0`
and thresholds strictly increasing, guaranteeing full coverage for decimals.
Used for both subject percentage→letter grade and final GPA→letter grade.

**AD-6 — Pass is declared by `grading_scales.min_pass_percentage`.**
Subject pass = `percentage >= min_pass_percentage` **AND** all component pass
checks pass. `min_pass_point` remains the minimum passing grade point
(1.00/2.00) for reporting/validation only. Seeds: Board 5.00 → 33.00, NU/IAU
4.00 → 40.00, Primary 4-Tier → 40.00.

**AD-7 — Cumulative-annual weighting table.**
`exam_term_weights(parent_exam_term_id, child_exam_term_id, weight_pct)` where the
parent is the `CUMULATIVE_ANNUAL` term. Validation: weights sum to 100.00.

**AD-8 — Sub-exam aggregation is normalise-then-scale.**
Each child component contributes fraction `f = converted / childConvertedMax`;
aggregate `f` by the term's `ct_aggregation_mode`, then multiply by the parent
component's `converted_max_marks`. When all child maxima are equal this reduces to
the source plan's plain averages. Implemented in `aggregateCt`
(`BEST_N_AVERAGE | BEST_N_SUM | ALL_AVERAGE | WEIGHTED_SUM`, capped at `1.0`
where applicable; `k = 0` returns `null` = pre-flight blocker, never a silent 0).

**AD-9 — `exam_controller` role added and seeded.**
The engine migration extends the `users.role` ENUM; `UserRole.EXAM_CONTROLLER`
added; `exam@school.com` seeded; new controllers gate on
`@Roles(ADMIN, MANAGEMENT, EXAM_CONTROLLER)` (`TEACHER` additionally gets marks
entry, lookups and reporting read access).

**AD-10 — Enum-ish columns are `VARCHAR` backed by TypeScript union types**
(repo convention), never native MySQL enums for new tables (except the
pre-existing `users.role`).

**AD-11 — Snapshot-only reporting.**
Reporting endpoints read **only** `student_subject_results` and
`student_term_marksheets`; zero on-the-fly recalculation. All indexes in §4 target
that (satisfies the <500 ms / 500-student target).

**AD-12 — Money/marks never touch JS floats.**
All arithmetic uses `decimal.js` with explicit `ROUND_HALF_UP`; values are
persisted as strings into `DECIMAL` columns.

---

## 4. Final data model

Prisma models in `apps/api/prisma/schema.prisma`; tables created by
`prisma/migrations/20261017135221_create_result_engine_tables/migration.sql`
(+ `20261017153015_fix_merged_row_unique_index/migration.sql`, see C16).

### 4.1 Reuse (do NOT recreate)

`AcademicSubjects`, `ClassSyllabusSubjects`, `StudentSubjectEnrollments`
(owned by admissions; the engine reads them via the shared
`SubjectEnrollmentService`).

### 4.2 Engine models — 8 core tables (`DECIMAL` per source, UUID PKs)

**`GradingScales`** → `grading_scales`
`id`, `name`, `scaleType` (`GPA_5|CGPA_4|DESCRIPTIVE_ONLY`), `maxPoint`,
`minPassPoint`, `minPassPercentage` *(AD-6)*, `fourthSubjectDeduction`
(default 2.00), `isActive`, `createdAt`. Index: `(is_active)`.

**`GradingScaleRanges`** → `grading_scale_ranges`
`id`, `gradingScaleId` FK ON DELETE CASCADE, `minPercentage`,
`maxPercentage` (informational, C7), `letterGrade`, `gradePoint`,
`descriptiveRemark` NULL. Index `(grading_scale_id, min_percentage)`.

**`AttendanceMarkSlabs`** → `attendance_mark_slabs`
`id`, `name`, `minAttendancePct`, `maxAttendancePct`, `awardedMarks`.
Index `(min_attendance_pct)`.

**`ExamTerms`** → `exam_terms`
`id`, `academicSessionId`, `classOrDeptId`, `gradingScaleId` FK, `termName`,
`termType` (`SUB_EXAM_CT|TERMINAL|CUMULATIVE_ANNUAL`), `parentTerminalExamId`
self-FK NULL, `sequenceNo` *(deterministic CT/term ordering)*,
`ctAggregationMode` (default `BEST_N_AVERAGE`), `ctBestCount` (default 2),
`annualWeightPct` (default 100.00), `markRoundingMode` (default
`HALF_UP_INTEGER`), `minCoursesToPromote` (default 0), `minCgpaToPromote`
(default 0.00), `status` (`SETUP|MARKS_ENTRY|PROCESSING|PUBLISHED|LOCKED`,
default `SETUP`), timestamps.
Indexes: `(academic_session_id, class_or_dept_id)`, `(parent_terminal_exam_id)`, `(status)`.

**`ExamSubjectComponents`** → `exam_subject_components`
`id`, `examTermId` FK ON DELETE CASCADE, `syllabusSubjectId` FK,
`componentCode` (`CT_INCOURSE|ATTENDANCE|CQ_WRITTEN|MCQ|PRACTICAL|VIVA`),
`componentName`, `sourceType` (`MANUAL_ENTRY|AUTO_FROM_SUB_EXAMS|AUTO_FROM_ATTENDANCE`),
`sourceComponentCode` NULL *(AD-8/C11)*, `maxRawMarks`, `conversionWeightPct`
(default 100.00), `convertedMaxMarks`, `minPassMarks` (default 0.00),
`displayOrder` (default 1).
Index `(exam_term_id, syllabus_subject_id)`; unique `(exam_term_id, syllabus_subject_id, component_code)`.

**`StudentComponentMarks`** → `student_component_marks`
`id`, `examTermId` FK, `studentId`, `syllabusSubjectId` FK, `componentId` FK,
`rawMarksObtained` (default 0.00), `convertedMarks` (default 0.00),
`isAbsent` (default false), `isExempted` (default false),
`isPassedComponent` (default true), `enteredBy`, `updatedAt`.
Unique `uq_student_exam_comp (exam_term_id, student_id, component_id)`.
Indexes: `(exam_term_id, syllabus_subject_id)`, `(student_id)`.

**`StudentSubjectResults`** → `student_subject_results`
Snapshot rows (paper rows + merged authority rows), UUID PK.
Unique `uq_result_subject (exam_term_id, student_id, syllabus_subject_id)`;
merged-row lookup index `IDX_SUBJECT_RESULTS_TERM_STUDENT_GROUP
(exam_term_id, student_id, combined_group_code)` (C16 — plain index, not unique).
Indexes: `(exam_term_id, assigned_role)`, `(exam_term_id, is_merged_summary_row)`.

**`StudentTermMarksheets`** → `student_term_marksheets`
Snapshot rows, UUID PK, unique `uq_term_marksheet (exam_term_id, student_id)`.
Indexes: `(exam_term_id, section_id)`, `(exam_term_id, shift_id)`,
`(exam_term_id, final_gpa_or_cgpa)`, `(exam_term_id, result_status)`.

### 4.3 Engine models — 3 support tables

**`ExamTermWeights`** (AD-7) — `id`, `parentExamTermId` FK,
`childExamTermId` FK, `weightPct`; unique `(parent_exam_term_id, child_exam_term_id)`.

**`ResultGenerationJobs`** (AD-2) — `id`, `examTermId` FK,
`status` (`QUEUED|RUNNING|COMPLETED|FAILED|CANCELLED`), `progressPct`,
`currentStage`, `totalStudents`, `processedStudents`, `errorMessage` NULL,
`requestedBy` NULL, `startedAt` NULL, `finishedAt` NULL, `createdAt`.
Index `(exam_term_id, status)`. One row is reused per term (CC-15).

**`StudentAttendanceSummaries`** (AD-4) — `id`, `examTermId` FK,
`studentId`, `attendancePercentage`, `source` (default `MANUAL`), `updatedAt`;
unique `(exam_term_id, student_id)`.

---

## 5. Exact calculation rules & corner-case register

All formulas implemented with `decimal.js`; every division guarded against zero.
Implemented in `calculation-engine/result-calculation.service.ts`
(`buildSnapshots`, pure/DB-free) + `common/` utils.

### CC-01 Grade lookup has no gaps
`resolvePercentageRange(p)` = row with the largest `min_percentage <= p`. So
`79.5 → A` (70–79 band). Validation: lowest `min_percentage = 0`, thresholds
strictly increasing. `resolveGpaRange` does the same on `grade_point`
thresholds (5.00 scale thresholds
`5.00,4.00,3.50,3.00,2.00,1.00,0.00`;
4.00 scale `4.00,3.75,3.50,3.25,3.00,2.75,2.50,2.25,2.00,0.00`).

### CC-02 Rounding is applied to the subject total, then the percentage
`mark_rounding_mode`: `HALF_UP_INTEGER` (default) → round total to 0 dp;
`CEILING_INTEGER` → ceil; `TWO_DECIMALS` → 2 dp. Percentage = `round(total / full ×
100, 2)`. Grade lookup uses the rounded percentage.

### CC-03 Penalty/absence semantics
`is_absent = true` ⇒ component contributes `0` and **fails** its component pass
check regardless of `min_pass_marks`. `is_exempted = true` ⇒ component excluded
from both the max and the pass check, and its `converted_max_marks` is subtracted
from the subject's effective full marks. A student absent for **all** components
⇒ subject `is_passed = false`, `fail_reason = 'ABSENT'`, `total = 0`.

### CC-04 Standalone subject (Case A)
`T = Σ converted_j` (exempted excluded); apply CC-02. Pass requires
`percentage >= scale.min_pass_percentage` AND — when
`pass_evaluation_mode = 'SEPARATE_COMPONENTS'` — every component with
`min_pass_marks > 0` satisfies `converted_j >= min_pass_marks_j` (absent ⇒ fail).
`fail_reason` priority: `ABSENT` → `FAILED_<CODE>` (first failing component in
display order) → `BELOW_TOTAL`.

### CC-05 Combined 1st/2nd paper (Case B)
- Shadow rows: one `student_subject_results` row **per paper**
  (`is_merged_summary_row = false`) with that paper's own total/percentage/letter/GP
  for display.
- Authority row: one merged row (`is_merged_summary_row = true`,
  `combined_group_code` set), `full_marks = Σ full_marks`,
  `total = Σ T_paper`, percentage/GP from the merged total.
- `COMBINED_PAPER_COMPONENTS`: for each component code `K` present in **any**
  paper, pass requires `Σ_papers converted(K) >= Σ_papers min_pass(K)` (a paper
  that carries `K` absent ⇒ fail). Missing `K` in a paper is treated as `min 0`.
- `SEPARATE_COMPONENTS`: each paper must independently satisfy CC-04.
- **Any number of papers per group is supported** (not just 2) — iterate by
  `combined_group_code`.

### CC-06 Sub-exam (CT/Incourse) aggregation (AD-8)
Children = `exam_terms where parent_terminal_exam_id = term.id`, ordered by
`sequence_no`. For each child, take the component with
`component_code = <parent.source_component_code>` for the same
`syllabus_subject_id`; `childMax` = its `converted_max_marks`,
`m` = converted mark (absent ⇒ 0). Let `f = m / childMax`
(`aggregateCt` in `common/ct-aggregation.util.ts`).

| mode | aggregate (then × parent `converted_max_marks`) |
| --- | --- |
| `BEST_N_AVERAGE` | mean of top‑`min(N,k)` `f` |
| `BEST_N_SUM` | sum of top‑`min(N,k)` `f`, capped at `1.0` |
| `ALL_AVERAGE` | mean of all `k` `f` (absent counts as 0) |
| `WEIGHTED_SUM` | `Σ f_i × weight_i` from child `annual_weight_pct`, capped at `1.0` |

`k = 0` ⇒ `null` **and a pre-flight blocker** (never silently 0).

### CC-07 4th subject bonus & fail immunity
`effective_gp = max(0, gp − scale.fourth_subject_deduction)`. A failed 4th
subject does **not** increment `failed_subject_count`; the student still passes if
all compulsory subjects pass. A 4th subject that is a merged group counts once.

### CC-08 GPA denominator
Only `COMPULSORY` (incl. `GROUP_ELECTIVE` enrolled as compulsory) rows count.
Merged groups count as **1**; standalone papers count as themselves; `NON_CREDIT`
is excluded from GPA but still printed. `total_compulsory_subjects = N`.

### CC-09 GPA_5 finalisation
If any compulsory failed ⇒ `gpa_without_fourth = 0.00`,
`final_gpa_or_cgpa = 0.00`, letter `F`, `result_status = FAILED`.
Else `gpa_without_fourth = round(ΣGP_comp / N, 2)` and
`final = min(max_point, round((ΣGP_comp + bonus) / N, 2))`; letter via CC-01.

### CC-10 CGPA_4 (Honours/Degree/Fazil/Kamil)
`weighted_i = GP_i × credit_hours_i`; `attempted = Σ credit_hours_i` (graded, non‑exempt);
`earned = Σ credit_hours_i` where passed;
`final = round(Σweighted_i / attempted, 2)` (guard `attempted = 0`).
Conditional promotion: if `failed > 0` but passed courses `>= min_courses_to_promote`
and `final >= min_cgpa_to_promote` ⇒ `result_status = PROMOTED_WITH_F`.

### CC-11 CUMULATIVE_ANNUAL (Stage 7)
Parent subject percentage = `Σ (child_weight_pct × child_subject_percentage) / 100`
from `exam_term_weights` (weights must sum to 100). Grade and GPA then computed on
the parent's own scale via CC-04/CC-08/CC-09. `component_breakdown_json` stores the
weighted child contributions for the marksheet.

### CC-12 Descriptive-only scales (Pre-Play / Primary)
No GPA arithmetic; `letter_grade` from ranges; `final_gpa_or_cgpa = 0.00` and
`final_letter_grade` = the resolved tier. Pass by `min_pass_percentage`.

### CC-13 Merit ranking (Stage 8)
Stable sort by: `failed_subject_count ASC → final_gpa_or_cgpa DESC →
gpa_without_fourth DESC → marks_with_fourth DESC → marks_without_fourth DESC →
attendance_percentage DESC → class_roll_no ASC` (from `student_enrollments`).
Positions computed independently for section / shift / class.
`final_gpa_or_cgpa` and `marks_*` compared as decimals, not floats.

### CC-14 NULL-keyed uniqueness
Merged rows have `syllabus_subject_id NULL`. As-built, uniqueness is
`uq_result_subject (exam_term_id, student_id, syllabus_subject_id)` for paper
rows plus the plain lookup index
`IDX_SUBJECT_RESULTS_TERM_STUDENT_GROUP (exam_term_id, student_id,
combined_group_code)` for merged rows (C16).

### CC-15 Re-generation is idempotent
One reused job row per term. Inside one transaction: delete existing
`student_subject_results` + `student_term_marksheets` for the term, recompute, bulk
insert with **stable content-derived ids** (`stableRowId`, so re-runs are
byte-identical), set `exam_term.status = 'PUBLISHED'`. Failure ⇒ rollback, job
`FAILED`, term unchanged.

### CC-16 Marks-entry validation
Accept `0 <= raw <= max_raw_marks` else 422 naming roll + component;
`converted = round(raw × conversion_weight_pct / 100, 2)` computed server-side
(client preview is advisory). Reject blocks on a managed server too.

### CC-17 Component-set validation (Phase 3 gate)
`Σ converted_max_marks (non-exempt) == class_syllabus_subjects.full_marks`, and
`converted_max_marks == round(max_raw_marks × conversion_weight_pct/100, 2)`.

### CC-18 State machine
`SETUP → MARKS_ENTRY → PROCESSING → PUBLISHED → LOCKED`. Marks entry blocked
unless `SETUP|MARKS_ENTRY`. Generation only from `MARKS_ENTRY`. Reopen
(`PUBLISHED → MARKS_ENTRY`) requires `EXAM_CONTROLLER` and logs who/when.

### CC-19 Empty / partial scopes
Zero enrolled students, or a student with no component rows (not even absent) ⇒
pre-flight blocker listing the exact gaps. Never produce a partial marksheet.

### CC-20 Decimal storage discipline
Percentages `DECIMAL(5,2)`, marks `DECIMAL(6,2)`, GPA/GP `DECIMAL(4,2)`, credits
`DECIMAL(4,2)`. Prisma returns them as strings at runtime; mappers coerce with
`String()`, compute with `decimal.js`, write strings. No
`Number()`/`parseFloat` on persisted values.

---

## 6. Phased execution plan

All phases delivered. Each phase lists the as-built files.

### PHASE 1 — Migrations + Bangladesh master seeder ✅
**Files**
- `apps/api/prisma/migrations/20261017135221_create_result_engine_tables/migration.sql`
  (8 core + 3 support tables + `users.role` ENUM extension; FK-safe order)
- `apps/api/prisma/migrations/20261017153015_fix_merged_row_unique_index/migration.sql`
  (C16: `uq_result_merged` → plain lookup index)
- `apps/api/prisma/schema.prisma` (11 engine models + relations/indexes)
- `apps/api/scripts/seed-academic-results.ts` (+ `seed:results` script in
  `apps/api/package.json`)
- `apps/api/src/academic-results/academic-results.module.ts`
  (+ registered in `app.module.ts`)

**Done**
1. Migration with exact columns/indexes from §4; follow-up fix migration for the merged-row index.
2. Idempotent seeder (keyed by name/email): 3 grading scales + all ranges,
   NU Honours 5-mark attendance slab, `exam_controller` user.
3. Per-scale `min_pass_percentage` (AD-6).

### PHASE 2 — Syllabus, paper-merger & enrollment APIs ✅
**Files** `apps/api/src/academic-results/syllabus-config/{service,controller,dto}.ts`
(extends the shared `admissions/subject-enrollment.service.ts` — never duplicated),
plus `apps/api/src/academic-results/lookups/{service,controller,dto}.ts` (AD-3).

**Done**
1. CRUD `academic_subjects` + `class_syllabus_subjects` (delegated to the shared service).
2. `matrix/clone` copies a session's syllabus (skip-existing + target re-validation in one transaction).
3. Combined-paper validation: rows sharing a `combined_group_code` must share
   `pass_evaluation_mode` + `default_subject_role` (descriptive 400).
4. Bulk enroll compulsory set by class/section/group + per-student 4th subject
   (reuses the enrollment uniqueness + exactly-one-4th guards; `dryRun` supported).
5. AD-3 lookups: `GET /academic-results/lookups/sessions|classes|sections|scope`.

### PHASE 3 — Exam term, CT rules & component distribution ✅
**Files** `apps/api/src/academic-results/exam-setup/{service,controller,dto}.ts`,
`.../exam-setup/validators/component-sum.validator.ts`.

**Done**
1. CRUD `exam_terms` (SUB_EXAM_CT / TERMINAL / CUMULATIVE_ANNUAL) + `exam_term_weights`.
2. CRUD `exam_subject_components` incl. bulk copy across same-type subjects.
3. CC-17 gate + CC-18 state machine (controller-only reopen) enforced.

### PHASE 4 — Marks entry, attendance auto-pull & CSV/OMR import ✅
**Files**
`apps/api/src/academic-results/marks-entry/{marks-entry.service,controller,dto}.ts`,
`.../marks-entry/csv-omr-parser.service.ts`,
`.../common/attendance-adapter.service.ts`,
`apps/web/src/app/api/academic-results/[...path]/route.ts` (proxy).

**Done**
1. Sheet endpoint → rows with component columns, maxima, ABSENT/EXEMPT flags, converted preview data.
2. Bulk upsert in one transaction, CC-16 validation, server-side conversion.
3. Auto-populate sub-exam (CC-06) + attendance (AD-4) marks.
4. CSV/OMR import with roll mapping + dry-run diff before commit (atomic reject on unknown roll).
5. Manual attendance-percentage entry per term.

### PHASE 5 — 8-stage calculation engine + job runner + merit ranking ✅
**Files**
`apps/api/src/academic-results/calculation-engine/{result-calculation.service,
result-job-runner.service,result-jobs.controller,pre-flight.service}.ts`,
`.../common/{decimal-math,decimal,grade-lookup,rounding,mapper,ct-aggregation,stable-id}.util.ts`,
`.../common/attendance-adapter.service.ts`,
`.../calculation-engine/result-calculation.service.spec.ts`,
`apps/api/scripts/verify-result-engine.ts`.

**Done**
1. Stages 1–8 per §5 as the pure `buildSnapshots(input)` function (+ `onProgress` callback).
2. Pre-flight validation service (CC-17, CC-19, AD-4, AD-7) exposed to the console.
3. Job runner + `result_generation_jobs` lifecycle (AD-2 / CC-15).

### PHASE 6 — Reporting, marksheets, tabulation & analytics API ✅
**Files**
`apps/api/src/academic-results/reports-transcripts/{service,controller,dto}.ts`.

**Done**
1. `GET reports/transcript` — components, merged summaries, class highest, GPA
   with/without 4th, merit, attendance, QR payload.
2. `GET reports/tabulation` — snapshot-only broadsheet.
3. `GET reports/analytics` — appeared/passed/failed/pass %, grade histogram,
   per-subject per-teacher breakdown (from `entered_by`).
4. `GET reports/merit-list` / `GET reports/fail-list`.

### PHASE 7 — Next.js frontend & print layouts ✅
**Files** under `apps/web/src/app/(protected)/admin/academic-results/` — one
`page.tsx` guard + `*View.tsx` per nav leaf (settings/grading-scales,
settings/syllabus-matrix, exams, exams/components, marks-entry, marks-entry/auto-sync,
marks-entry/import, marks-entry/tracker, process, outputs/marksheets,
outputs/tabulation-sheet, outputs/merit-list, outputs/analytics), plus
`apps/web/src/lib/academic-results.ts` and `_components/shared.tsx`.

**Done**
1. Configurators with preset buttons (*NCTB Secondary 5.00*, *Madrasah Dakhil/Alim*,
   *NU Honours 4.00*, *Primary 4-Tier*).
2. Keyboard-first `@tanstack/react-table` grid: arrows/Enter/Tab nav, `A` toggles
   absent, over-max → red border + blocked save, live converted preview.
3. Process console: pre-flight checklist + live stage progress polled from the job endpoint.
4. Print: A4 marksheet (`id="printable-marksheet-area"`, merged 1st/2nd paper
   `rowSpan={2}`, grading legend top-right, QR, signature blocks) and A3/Legal
   landscape tabulation via `printElement`/`PrintMenu`.
5. Every filter row uses `SearchSelect`/`DatePickerField`, 30 px controls,
   `rounded-xs` (per `AGENTS.md`).

---

## 7. Test matrix

| ID | Fixture | Expected | Covered by |
| --- | --- | --- | --- |
| T1 | 5×A+ + A + 4th A+ | GPA 4.83 → final 5.00 | jest + verify |
| T2 | Physics MCQ 7/25 (pass 8) | F / 0.00 / FAILED_MCQ | jest + verify |
| T3 | Bangla CQ 18+30 / 140 (pass 46) | pass | jest + verify |
| T4 | 4×4cr + 1×2cr lab | CGPA 3.56 | jest + verify |
| T5 | `79.5%` subject | A (4.00), no gap | jest + verify |
| T6 | 4th subject F | `failed_subject_count = 0`, still PASSED | verify |
| T7 | Compulsory F | GPA 0.00 / F / FAILED | verify |
| T8 | All absent | subject ABSENT, result FAILED | jest + verify |
| T9 | `BEST_N_AVERAGE`, N=2, k=3, unequal maxima | normalise-then-scale value (0.85 → 17.00 on max 20; k=0 ⇒ blocker) | verify (`aggregateCt`) |
| T10 | Readmit / re-run twice | identical snapshots, 1 reused job row | jest + verify (pure determinism + stable ids; single-row reuse in `ResultJobRunnerService.ensureJobRow`) |
| T11 | `min_courses_to_promote` met with 1 F (4.00) | PROMOTED_WITH_F (2.80) | jest + verify |
| T12 | Primary descriptive scale | tier letter, no GPA, no F | jest + verify |
| T13 | Exempted component | max reduced, excluded from pass | jest + verify |
| T14 | Marks 100 × 4 in one tx | `< 300 ms` (pure-engine proxy: ~22 ms) | verify (timing smoke) |
| T15 | 500-student tabulation | `< 500 ms`, no recalc (pure-engine proxy: ~21 ms) | verify (timing smoke) |

- Jest: `pnpm --filter api test` — 124 tests green (12 engine specs in
  `result-calculation.service.spec.ts`).
- Fixture: `pnpm --filter api run verify:results` — DB-free T1–T15 assertions,
  non-zero exit on failure. T14/T15 measure the pure engine and print timings;
  they guardrail at 10x the plan target (the plan targets cover the DB
  transaction + HTTP path, not the pure function).

---

## 8. Verification commands

```bash
pnpm --filter api prisma:status        # migration state
pnpm --filter api prisma:deploy        # apply migrations (servers)
pnpm --filter api run seed:results     # idempotent Bangladesh master data
pnpm --filter api run verify:results   # DB-free T1–T15 assertions
pnpm --filter api test                 # jest (124 green)
pnpm --filter api build                # prisma generate + nest build
pnpm --filter web build                # next build (all 13 result routes)
pnpm dev                               # manual E2E: configure → enter → process → print
```

---

## 9. Risk register & open questions — resolved

| # | Question | Decision (built) |
| --- | --- | --- |
| Q1 | Scope: full 7 phases, or backend first? | **All 7 delivered** (P1→P7 in order). |
| Q2 | In-DB job runner vs. Redis+BullMQ? | **In-DB runner** (AD-2); lift path preserved via `onProgress`. |
| Q3 | Calendar module vs. derived options? | **Derived** via `GET /academic-results/lookups/*` (AD-3); calendar stays a separate feature. |
| Q4 | Attendance table now or defer? | **Table + manual/CSV entry now** (AD-4); auto-pull when the attendance module lands. |
| Q5 | Primary pass rule? | **Configurable `min_pass_percentage`** (Board 33 / NU 40 / Primary 40; set 0 for no-fail schools). |
| Q6 | CT aggregation formula? | **Normalise-then-scale** (AD-8/CC-06), reduces to plain averages on equal maxima. |
| Q7 | Cumulative-annual now or later? | **Implemented**, guarded by `exam_term_weights`; covered by CC-11 regression spec. |
| Q8 | MySQL `(UUID())` vs. portable UUIDs? | **Kept repo consistency** (`dbgenerated("(uuid())")`); portability stays a separate task. |
| Q9 | `exam_controller` role + seeded user? | **Yes** — delivered (migration + seed + guards). |
| Q10 | Rewire public `/result/exam-result` mock to real published results? | **Follow-up, still open** — the mock lookup is untouched by this delivery. |

**Residual risks:** (1) scope dropdowns show raw UUIDs with counts until a
calendar module provides names — accepted; (2) T14/T15 plan targets cover the
DB/HTTP path and are only smoke-proxied by the verify script — a staging
measurement against 500 real students is still worthwhile; (3) cumulative-annual
(CC-11) remains the least battle-tested rule — isolated to its own guarded path.
