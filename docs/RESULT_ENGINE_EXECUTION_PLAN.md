# Result Engine — Step-by-Step Execution Plan

> **Derived from:** `docs/RESULT_ENGINE_PLAN.md` (the source spec)
> **Author role:** System Architect (`.opencode/agents/system-architect.md`)
> **Date:** 2026-10-16
> **Status:** ⛔ BLOCKED ON SIGN-OFF — do not start coding until §9 open questions are answered.

This document converts the source spec into an executable plan that matches the
**actual** repository. It is intentionally opinionated about the parts of the
source spec that do not survive contact with the codebase (ID types, folder
layout, route groups, missing dependencies) and it enumerates the edge cases the
engine must handle so results are correct for every level from Pre-Play to
Kamil/Masters.

---

## 1. Ground truth — what already exists

Verified by reading the repo, not the plan.

### 1.1 Backend (`apps/api`)

| Area | Reality | File(s) |
| --- | --- | --- |
| Framework | NestJS 11, CommonJS, `strict` **off** | `apps/api/package.json`, `tsconfig.json` |
| ORM | TypeORM 0.3.x, MySQL (`mysql2`), `synchronize: false` | `src/database/data-source.ts` |
| Entity registry | **Explicit array** in `dataSourceOptions.entities` — every new entity MUST be added here | `src/database/data-source.ts:60` |
| Migrations | `migrations: ['src/database/migrations/*.ts']`; Laravel-style filenames via `pnpm migration:make <desc>` | `scripts/make-migration.mjs` |
| PK convention | UUID `CHAR(36)`, `@PrimaryGeneratedColumn('uuid')`, migration default `(UUID())` | all entities/migrations |
| Decimal math | `decimal.js` **already a dependency** | `apps/api/package.json:31` |
| Roles | `UserRole` enum = `admin, management, accountant, teacher, student, guardian` only. `@Roles()` + `RolesGuard` exist | `src/database/entities/user-role.enum.ts`, `src/common/guards/roles.guard.ts` |
| Auth | Global `JwtAuthGuard` via `APP_GUARD`; `@Public()` opts out | `src/app.module.ts:58` |
| Seeds | Separate, manually-run scripts: `seed.ts`, `seed-accounting.ts`, `seed-admissions.ts`, each wired as a `package.json` script | `apps/api/src/database/`, `apps/api/package.json` |
| Queue | **No `@nestjs/bullmq`, no Redis, no `@nestjs/schedule`** | `apps/api/package.json` |

### 1.2 Subjects tables already built (Result Plan §2)

Migration `2026_10_24_100000_create_subject_tables.ts` + entities already exist:

- `academic_subjects` — `id, subject_code, subject_name, board_stream, paper_number`
- `class_syllabus_subjects` — `id, academic_session_id, class_or_dept_id, subject_id,
  combined_group_code, combined_group_name, default_subject_role, elective_group,
  credit_hours, full_marks, pass_evaluation_mode, display_order`
- `student_subject_enrollments` — `id, academic_session_id, student_id,
  syllabus_subject_id, assigned_role` + unique `(session, student, syllabus_subject)`

So **3 of the 11 source tables exist**; **8 must be created** (§4).

### 1.3 Frontend (`apps/web`)

| Area | Reality | File(s) |
| --- | --- | --- |
| Route base | **`(protected)/admin/...`**, NOT `(dashboard)/...` | `apps/web/src/app/(protected)/admin/` |
| Page pattern | `page.tsx` = session guard + `*View.tsx` client component | `.../admin/accounting/chart-of-accounts/page.tsx` |
| API calls | Same-origin `apiFetch` → catch-all proxy route → NestJS | `src/lib/api.ts`, `src/app/api/accounting/[...path]/route.ts` |
| Table lib | `@tanstack/react-table ^8.21.3` **already installed** | `apps/web/package.json:13` |
| UI kit | `DashPageHeader`, `DashCard`, `AdminPageLoader`, `SearchSelect`, `DatePickerField`, `PrintMenu` | `src/components/dashboard/`, `src/components/ui/` |
| Nav | The **entire "Exam & Result Engine" nav tree already exists** and points at the target routes | `src/lib/nav-config.ts:257-403` |
| Existing stub | `/admin/results` is a placeholder linking to a mock public lookup | `admin/results/ResultsView.tsx`, `components/ResultLookup.tsx` |

### 1.4 Dependencies the source plan silently assumes — **they do not exist**

| Assumed | Status | Impact |
| --- | --- | --- |
| Academic calendar (sessions, classes, sections, shifts, groups) | ❌ none — IDs are opaque UUIDs typed by hand | UI cannot populate real dropdowns; see **AD-3** |
| Attendance module | ❌ none (only `attendance.view/edit` permission seeds) | `AUTO_FROM_ATTENDANCE` has no source; see **AD-4** |
| BullMQ + Redis | ❌ not installed | Background calculation must use a portable job runner; see **AD-2** |
| `exam_controller` role | ❌ not in `UserRole` enum | Nav expects it; see **AD-9** |

---

## 2. Corrections to the source plan

Every row is a place the source spec would mislead a build agent.

| # | Source plan says | Repo reality | Correction |
| --- | --- | --- | --- |
| C1 | `BIGINT AUTO_INCREMENT` PKs | UUID `CHAR(36)` everywhere | Use UUID + `@PrimaryGeneratedColumn('uuid')`; migration default `('(UUID())')` to match existing migrations. (Portability caveat noted in §9 Q8.) |
| C2 | Backend dir `src/modules/academic-results/` | Module dirs are `src/<module>/` | Use **`apps/api/src/academic-results/`**. |
| C3 | Frontend `(dashboard)/academic-results/` | Routes are `(protected)/admin/<module>/` | Use **`apps/web/src/app/(protected)/admin/academic-results/`** (matches `nav-config.ts` exactly). |
| C4 | "Prisma or TypeORM" | TypeORM only | TypeORM everywhere. |
| C5 | `@nestjs/bullmq` worker | Not installed, no Redis | In-DB job table + in-process runner (**AD-2**). |
| C6 | 11 tables | 3 already exist | Create only the **8 missing** tables + 3 support tables (§4). |
| C7 | Seed `80-100 A+`, `70-79 A`, … (closed integer bands) | Marks can be decimal (`DECIMAL(8,2)`) | Bands have gaps at `79.5`. Use **greatest-`min_percentage`-≤ value** lookup (CC-01). `max_percentage` becomes informational. |
| C8 | "verify `T ≥` Scale Min Pass **Percentage**" but scale stores `min_pass_point` (a grade point) | Type mismatch | Add an explicit **`min_pass_percentage`** column to `grading_scales` (AD-6). |
| C9 | Stage 7 "25% Term1 + 25% Term2 + 50% Final" but only a single `annual_weight_pct` column exists | No per-child weight storage | Add **`exam_term_weights`** table (AD-7). |
| C10 | Rule 1 aggregates child marks "scaled to converted_max_marks" | Each CT child can have a different max | Define **normalise-then-scale** formula (CC-06 / AD-8). |
| C11 | `AUTO_FROM_SUB_EXAMS` component pulls child marks | No link saying *which* child component | Add **`source_component_code`** column on `exam_subject_components`. |
| C12 | Merit tie-break "previous_roll" | No such column | Use `student_enrollments.class_roll_no` for the session/class. |
| C13 | Multi-tenant roles `EXAM_CONTROLLER` | Enum lacks it | Add enum value via migration (mirrors `add_accountant_role`) — AD-9. |
| C14 | Attendance component automatic | No attendance source | Adapter + optional summary table (AD-4). |
| C15 | Web calls `/api/...` | Needs a proxy route per module | Add `apps/web/src/app/api/academic-results/[...path]/route.ts` (copy of accounting proxy). |
| C16 | `student_subject_results.syllabus_subject_id` NULLable for merged rows + plan's plain unique | MySQL allows many NULLs | Use two partial-equivalent uniques: `(term,student,syllabus_subject)` and `(term,student,combined_group_code)` (CC-14). |

---

## 3. Architecture decisions (AD-n)

> Decisions **AD-2, AD-3, AD-4, AD-6, AD-7, AD-8, AD-9** need sign-off (§9).

**AD-1 — New module is `academic-results`, entities live in the shared entity dir.**
Create `apps/api/src/academic-results/` with `grading-scales/`, `syllabus-config/`,
`exam-setup/`, `marks-entry/`, `calculation-engine/`, `reports-transcripts/`,
`common/`. One `academic-results.module.ts` registers everything (like
`accounting.module.ts`). Entities are added to
`apps/api/src/database/entities/` and to the `dataSourceOptions.entities` array.
*Rejected:* per-feature entity folders — breaks the existing registry pattern.

**AD-2 — Background calculation uses an in-DB job table + async in-process runner (no Redis).**
Add `result_generation_jobs` and a `ResultJobRunner` that processes jobs after the
HTTP request returns (`setImmediate`, chunked, `await`ed between chunks). The pure
`ResultCalculationService` takes an `onProgress` callback so it can be lifted to
BullMQ later with zero algorithm changes. Guarantees: one active job per
`exam_term` (enforced by a conditional insert / row lock), idempotent
delete-and-recompute inside one transaction, progress `0→100`, rollback on error.
*Rejected:* installing Redis+BullMQ now — new infra, not needed for single-node
result generation, and it would block the whole feature on DevOps.

**AD-3 — Academic calendar stays external/opaque; UI derives options from existing data.**
`academic_session_id`, `class_or_dept_id`, `section_or_batch_id`, `shift_id` are
opaque UUIDs owned by a future calendar module (consistent with Admissions).
Result Engine never joins them. For dropdowns, expose `GET
/academic-results/lookups/{sessions,classes,sections}` returning **distinct
values already present** in `student_subject_enrollments` / `student_enrollments` /
`class_syllabus_subjects`, so UI filtering works today without a calendar module.
*Rejected:* building the calendar module inside this feature — scope explosion.

**AD-4 — Attendance is an adapter with a manual-override table.**
Create `student_attendance_summaries(exam_term_id, student_id,
attendance_percentage, source, updated_at)` and a `ResultAttendanceAdapter` with
`getAttendancePct(termId, studentId)`. Today it reads this table (populated by
manual entry / CSV import); a future attendance module implements the same
interface. `AUTO_FROM_ATTENDANCE` components map pct→marks through
`attendance_mark_slabs`. *Rejected:* skipping attendance — NU/IAU CGPA requires it.

**AD-5 — Deterministic grade lookup, gap-proof.**
`resolveRange(value, rows, key=min_percentage)` returns the row with the greatest
`min_*` that is `<= value`. Validation requires the lowest threshold to be `0`
and thresholds strictly increasing, guaranteeing full coverage for decimals.
Used for both subject percentage→letter grade and final GPA→letter grade.

**AD-6 — Pass is declared by `grading_scales.min_pass_percentage` (new column).**
Subject pass = `percentage >= min_pass_percentage` **AND** all component pass
checks pass. `min_pass_point` remains the minimum passing grade point (1.00/2.00)
for reporting/validation only. Seed: Board 5.00 → 33.00, NU/IAU 4.00 → 40.00,
Primary 4-Tier → 40.00 (see Q5).

**AD-7 — Cumulative-annual weighting table.**
`exam_term_weights(parent_exam_term_id, child_exam_term_id, weight_pct)` where the
parent is the `CUMULATIVE_ANNUAL` term. Validation: weights sum to 100.00.

**AD-8 — Sub-exam aggregation is normalise-then-scale.**
Each child component contributes fraction `f = converted / childConvertedMax`;
aggregate `f` by the term's `ct_aggregation_mode`, then multiply by the parent
component's `converted_max_marks`. When all child maxima are equal this reduces to
the source plan's plain averages. Formula table in §5 CC-06.

**AD-9 — Add `exam_controller` to the user role enum.**
New migration `ALTER TABLE users MODIFY role ENUM(...,'exam_controller')` exactly
like `2026_10_16_100000_add_accountant_role.ts`; add
`EXAM_CONTROLLER = 'exam_controller'` to `UserRole`; seed an
`exam@school.com` user; extend `RolesGuard` usage in new controllers with
`@Roles(ADMIN, MANAGEMENT, EXAM_CONTROLLER)`. `TEACHER` gets marks entry only.
*Note:* the web `UserRole`/`legacyRoles` model in `nav-config.ts` is a separate
mock layer — do not change it here.

**AD-10 — Enums are `VARCHAR` backed by TypeScript union types** (repo convention),
never native MySQL enums for new tables (except the pre-existing `users.role`).

**AD-11 — Snapshot-only reporting.**
Reporting endpoints read **only** `student_subject_results` and
`student_term_marksheets`; zero on-the-fly recalculation. All indexes in §4 target
that (satisfies the <500 ms / 500-student target).

**AD-12 — Money/marks never touch JS floats.**
All arithmetic uses `decimal.js` with explicit `ROUND_HALF_UP`; values are
persisted as strings into `DECIMAL` columns.

---

## 4. Final data model

### 4.1 Reuse (do NOT recreate)

`academic_subjects`, `class_syllabus_subjects`, `student_subject_enrollments`
(see §1.2).

### 4.2 Create — 8 core tables (`DECIMAL` per source, UUID PKs)

**`grading_scales`**
`id CHAR(36) PK`, `name VARCHAR(100)`, `scale_type VARCHAR(30)`
(`GPA_5|CGPA_4|DESCRIPTIVE_ONLY`), `max_point DECIMAL(4,2)`,
`min_pass_point DECIMAL(4,2)`, `min_pass_percentage DECIMAL(5,2) DEFAULT 33.00` *(new, AD-6)*,
`fourth_subject_deduction DECIMAL(4,2) DEFAULT 2.00`, `is_active BOOLEAN DEFAULT TRUE`,
`created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
Index: `(is_active)`.

**`grading_scale_ranges`**
`id`, `grading_scale_id CHAR(36) FK→grading_scales ON DELETE CASCADE`,
`min_percentage DECIMAL(5,2)`, `max_percentage DECIMAL(5,2)`,
`letter_grade VARCHAR(10)`, `grade_point DECIMAL(4,2)`,
`descriptive_remark VARCHAR(100) NULL`. Index `(grading_scale_id, min_percentage)`.

**`attendance_mark_slabs`**
`id`, `name VARCHAR(100)`, `min_attendance_pct DECIMAL(5,2)`,
`max_attendance_pct DECIMAL(5,2)`, `awarded_marks DECIMAL(5,2)`.
Index `(min_attendance_pct)`.

**`exam_terms`**
`id`, `academic_session_id CHAR(36)`, `class_or_dept_id CHAR(36)`,
`grading_scale_id CHAR(36) FK`, `term_name VARCHAR(100)`,
`term_type VARCHAR(30)` (`SUB_EXAM_CT|TERMINAL|CUMULATIVE_ANNUAL`),
`parent_terminal_exam_id CHAR(36) NULL FK self`,
`sequence_no INT DEFAULT 1` *(new — deterministic CT/term ordering)*,
`ct_aggregation_mode VARCHAR(30) DEFAULT 'BEST_N_AVERAGE'`,
`ct_best_count INT DEFAULT 2`, `annual_weight_pct DECIMAL(5,2) DEFAULT 100.00`,
`mark_rounding_mode VARCHAR(20) DEFAULT 'HALF_UP_INTEGER'`,
`min_courses_to_promote INT DEFAULT 0`, `min_cgpa_to_promote DECIMAL(4,2) DEFAULT 0.00`,
`status VARCHAR(20) DEFAULT 'SETUP'`
(`SETUP|MARKS_ENTRY|PROCESSING|PUBLISHED|LOCKED`),
`created_at`, `updated_at`.
Indexes: `(academic_session_id, class_or_dept_id)`, `(parent_terminal_exam_id)`, `(status)`.

**`exam_subject_components`**
`id`, `exam_term_id FK ON DELETE CASCADE`, `syllabus_subject_id FK`,
`component_code VARCHAR(30)` (`CT_INCOURSE|ATTENDANCE|CQ_WRITTEN|MCQ|PRACTICAL|VIVA`),
`component_name VARCHAR(60)`, `source_type VARCHAR(30)`
(`MANUAL_ENTRY|AUTO_FROM_SUB_EXAMS|AUTO_FROM_ATTENDANCE`),
`source_component_code VARCHAR(30) NULL` *(new, AD-8/C11)*,
`max_raw_marks DECIMAL(6,2)`, `conversion_weight_pct DECIMAL(5,2) DEFAULT 100.00`,
`converted_max_marks DECIMAL(6,2)`, `min_pass_marks DECIMAL(6,2) DEFAULT 0.00`,
`display_order INT DEFAULT 1`.
Index `(exam_term_id, syllabus_subject_id)`; unique `(exam_term_id, syllabus_subject_id, component_code)`.

**`student_component_marks`**
`id`, `exam_term_id FK`, `student_id CHAR(36)`, `syllabus_subject_id FK`,
`component_id FK`, `raw_marks_obtained DECIMAL(6,2) DEFAULT 0.00`,
`converted_marks DECIMAL(6,2) DEFAULT 0.00`, `is_absent BOOLEAN DEFAULT FALSE`,
`is_exempted BOOLEAN DEFAULT FALSE`, `is_passed_component BOOLEAN DEFAULT TRUE`,
`entered_by CHAR(36)`, `updated_at TIMESTAMP`.
Unique `uq_student_exam_comp (exam_term_id, student_id, component_id)`.
Index `(exam_term_id, syllabus_subject_id)`, `(student_id)`.

**`student_subject_results`**
All source columns, UUID PK, plus uniques (CC-14):
`uq_result_subject (exam_term_id, student_id, syllabus_subject_id)`,
`uq_result_merged (exam_term_id, student_id, combined_group_code)`.
Indexes: `(exam_term_id, assigned_role)`, `(exam_term_id, is_merged_summary_row)`.

**`student_term_marksheets`**
All source columns, UUID PK, unique `uq_term_marksheet (exam_term_id, student_id)`.
Indexes: `(exam_term_id, section_id)`, `(exam_term_id, shift_id)`,
`(exam_term_id, final_gpa_or_cgpa)`, `(exam_term_id, result_status)`.

### 4.3 Create — 3 support tables

**`exam_term_weights`** (AD-7) — `id`, `parent_exam_term_id FK`,
`child_exam_term_id FK`, `weight_pct DECIMAL(5,2)`;
unique `(parent_exam_term_id, child_exam_term_id)`.

**`result_generation_jobs`** (AD-2) — `id`, `exam_term_id FK`,
`status VARCHAR(20)` (`QUEUED|RUNNING|COMPLETED|FAILED|CANCELLED`),
`progress_pct INT DEFAULT 0`, `current_stage VARCHAR(60)`,
`total_students INT DEFAULT 0`, `processed_students INT DEFAULT 0`,
`error_message VARCHAR(500) NULL`, `requested_by CHAR(36) NULL`,
`started_at TIMESTAMP NULL`, `finished_at TIMESTAMP NULL`,
`created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
Index `(exam_term_id, status)`.

**`student_attendance_summaries`** (AD-4) — `id`, `exam_term_id FK`,
`student_id CHAR(36)`, `attendance_percentage DECIMAL(5,2)`,
`source VARCHAR(20) DEFAULT 'MANUAL'`, `updated_at TIMESTAMP`;
unique `(exam_term_id, student_id)`.

---

## 5. Exact calculation rules & corner-case register

All formulas implemented with `decimal.js`; every division guarded against zero.

### CC-01 Grade lookup has no gaps
`resolveRange(p)` = row with the largest `min_percentage <= p`. So `79.5 → A`
(70–79 band). Validation: lowest `min_percentage = 0`, thresholds strictly
increasing. Same function resolves final GPA→letter via `grade_point` thresholds
(5.00 scale thresholds `5.00,4.00,3.50,3.00,2.00,1.00,0.00`;
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
`m` = converted mark (absent ⇒ 0). Let `f = m / childMax`.

| mode | aggregate (then × parent `converted_max_marks`) |
| --- | --- |
| `BEST_N_AVERAGE` | mean of top‑`min(N,k)` `f` |
| `BEST_N_SUM` | sum of top‑`min(N,k)` `f`, capped at `1.0` |
| `ALL_AVERAGE` | mean of all `k` `f` (absent counts as 0) |
| `WEIGHTED_SUM` | `Σ f_i × weight_i` from child `annual_weight_pct`, capped at `1.0` |

`k = 0` ⇒ component = 0 **and a pre-flight blocker** (never silently 0).

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
`final_letter_grade` = the resolved tier. Pass by `min_pass_percentage` (Q5).

### CC-13 Merit ranking (Stage 8)
Stable sort by: `failed_subject_count ASC → final_gpa_or_cgpa DESC →
gpa_without_fourth DESC → marks_with_fourth DESC → marks_without_fourth DESC →
attendance_percentage DESC → class_roll_no ASC` (from `student_enrollments`).
Positions computed independently for section / shift / class.
`final_gpa_or_cgpa` and `marks_*` compared as decimals, not floats.

### CC-14 NULL-keyed uniqueness
Merged rows have `syllabus_subject_id NULL`; MySQL/Postgres allow many NULLs, so
uniqueness is enforced by the two separate uniques in §4.2 (`uq_result_subject`,
`uq_result_merged`).

### CC-15 Re-generation is idempotent
One active job per term. Inside one transaction: delete existing
`student_subject_results` + `student_term_marksheets` for the term, recompute, bulk
insert, set `exam_term.status = 'PUBLISHED'`. Failure ⇒ rollback, job `FAILED`,
term unchanged.

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
`DECIMAL(4,2)`. Read as strings, compute with `decimal.js`, write strings. No
`Number()`/`parseFloat` on persisted values.

---

## 6. Phased execution plan

Each phase ends with the listed acceptance tests and must pass before the next.

### PHASE 1 — Migrations + Bangladesh master seeder
**Files**
- `apps/api/src/database/migrations/2026_10_29_100000_create_result_engine_tables.ts`
  (8 core + 3 support tables, FK-safe order, `down()` reverse)
- `apps/api/src/database/migrations/2026_10_30_100000_add_exam_controller_role.ts` (AD-9)
- `apps/api/src/database/entities/*.entity.ts` (11 new entity files)
- `apps/api/src/database/entities/user-role.enum.ts` (add `EXAM_CONTROLLER`)
- `apps/api/src/database/data-source.ts` (register all 11 entities)
- `apps/api/src/database/seed-academic-results.ts` (+ `seed:results` script in
  `apps/api/package.json`)
- module skeleton `apps/api/src/academic-results/academic-results.module.ts`
  (+ register in `app.module.ts`)

**Tasks**
1. Write migration with exact columns/indexes from §4; verify it also reverts.
2. Seed idempotently (keyed by name): 3 grading scales, all ranges, 5-mark
   attendance slab, `exam_controller` user.
3. Add per-scale `min_pass_percentage` (AD-6).

**Acceptance**
- [ ] `pnpm migration:run` then `pnpm migration:revert` then `run` again is clean.
- [ ] Re-running the seeder does not duplicate rows.
- [ ] Seeds match §5 scale tables (5.00, 4.00, Primary 4-Tier) exactly.

### PHASE 2 — Syllabus, paper-merger & enrollment APIs
**Files** `apps/api/src/academic-results/syllabus-config/{service,controller,dto}.ts`
(extend, do not duplicate, the existing `admissions/subject-enrollment.service.ts`).

**Tasks**
1. CRUD `academic_subjects` + `class_syllabus_subjects`.
2. `cloneSyllabusFromPreviousSession(source, target)`.
3. Validation: all rows sharing a `combined_group_code` in a class must share
   `pass_evaluation_mode` + `default_subject_role`.
4. Bulk enroll compulsory subjects by class/section/group; assign 4th subject per
   student (reuse the existing enrollment service uniqueness guard).

**Acceptance**
- [ ] Can configure SSC Class 9 Science: Bangla 1st+2nd merged
  (`COMBINED_PAPER_COMPONENTS`), Physics standalone (`SEPARATE_COMPONENTS`),
  Higher Math as `FOURTH_OPTIONAL`.
- [ ] Can configure Dakhil Class 9: Quran Mazid, Hadith, Aqaid + standalone
  Arabic 1st/2nd.
- [ ] Mismatched merger roles are rejected with a descriptive 400.

### PHASE 3 — Exam term, CT rules & component distribution
**Files** `apps/api/src/academic-results/exam-setup/{service,controller,dto}.ts`,
`.../exam-setup/validators/component-sum.validator.ts`.

**Tasks**
1. CRUD `exam_terms` (SUB_EXAM_CT / TERMINAL / CUMULATIVE_ANNUAL) +
   `exam_term_weights`.
2. CRUD `exam_subject_components` incl. bulk copy across same-type subjects.
3. Enforce CC-17 and the state machine (CC-18).

**Acceptance**
- [ ] Rejects component sets whose Σ `converted_max_marks` ≠ `full_marks`.
- [ ] Rejects annual weights that do not sum to 100.
- [ ] `source_component_code` required when `source_type = AUTO_FROM_SUB_EXAMS`.

### PHASE 4 — Marks entry, attendance auto-pull & CSV/OMR import
**Files**
`apps/api/src/academic-results/marks-entry/{marks-entry.service,controller,dto}.ts`,
`.../marks-entry/csv-omr-parser.service.ts`,
`.../common/attendance-adapter.service.ts`,
`apps/web/src/app/api/academic-results/[...path]/route.ts` (proxy).

**Tasks**
1. `getMarksEntrySheet(term, subject, section)` → rows with component columns,
   maxima, ABSENT/EXEMPT flags, live converted preview data.
2. `bulkUpsertComponentMarks(dto)` — one transaction, CC-16 validation, server-side
   conversion.
3. `autoPopulateSubExamAndAttendanceMarks(term)` — uses AD-4 adapter + CC-06.
4. `importMarksFromCsvOrOmr(file)` — map roll/registration → marks, with a dry-run
   diff before commit.
5. Manual attendance-percentage entry for the term.

**Acceptance**
- [ ] Raw mark > `max_raw_marks` ⇒ 422 naming roll + component.
- [ ] 100 students × 4 components upsert in one transaction, `< 300 ms` (local).
- [ ] CSV import with an unknown roll reports the row and rejects atomically.

### PHASE 5 — 8-stage calculation engine + job runner + merit ranking
**Files**
`apps/api/src/academic-results/calculation-engine/{result-calculation.service,
result-job-runner.service,result-jobs.controller,pre-flight.service}.ts`,
`.../common/{decimal-math,grade-lookup,rounding,mapper}.util.ts`,
`.../calculation-engine/result-calculation.service.spec.ts`.

**Tasks**
1. Implement stages 1–8 exactly per §5 (pure, `onProgress` callback).
2. Pre-flight validation service (CC-19, CC-17) exposed to the console.
3. Job runner + `result_generation_jobs` lifecycle (AD-2 / CC-15).

**Acceptance (must match source plan §5 exactly)**
- [ ] 5×`A+` + 1×`A` + 4th `A+` ⇒ `gpa_without_fourth = 4.83`,
  `final_gpa_or_cgpa = 5.00`.
- [ ] Physics `85/100` with MCQ `7/25` (pass 8) ⇒ `GP 0.00`,
  `fail_reason = 'FAILED_MCQ'`.
- [ ] Bangla CQ `18/70` + `30/70` (Σ `48/140`, pass 46) ⇒ passes via
  `COMBINED_PAPER_COMPONENTS`.
- [ ] Four 4-credit courses `4.00, 3.75, 3.25, 3.00` + one 2-credit lab `4.00`
  ⇒ CGPA exactly `3.56`.
- [ ] Re-running generation produces byte-identical snapshots and one job row.
- [ ] Failure mid-run rolls back and leaves the previous result intact.

### PHASE 6 — Reporting, marksheets, tabulation & analytics API
**Files**
`apps/api/src/academic-results/reports-transcripts/{service,controller,dto}.ts`.

**Tasks**
1. `getStudentTranscript(term, student)` — components, merged summaries, class
   highest, GPA with/without 4th, merit, attendance, QR payload.
2. `getMasterTabulationBroadsheet(term, class, section)` — snapshot-only.
3. `getExamSummaryAnalytics(term)` — appeared/passed/failed/pass %, grade
   histogram, per-subject per-teacher breakdown (from `entered_by`).
4. `getMeritList` / `getFailList`.

**Acceptance**
- [ ] Tabulation for 500 students × all subjects/components `< 500 ms` (indexed,
      no recalculation).
- [ ] Transcript returns identical numbers to the stored snapshot.

### PHASE 7 — Next.js frontend & print layouts
**Files** under `apps/web/src/app/(protected)/admin/academic-results/` — one
`page.tsx` guard + `*View.tsx` per nav leaf (settings/grading-scales,
settings/syllabus-matrix, exams, exams/components, marks-entry, marks-entry/auto-sync,
marks-entry/import, marks-entry/tracker, process, outputs/marksheets,
outputs/tabulation-sheet, outputs/merit-list, outputs/analytics), plus
`apps/web/src/lib/academic-results.ts`.

**Tasks**
1. Configurators with preset buttons (*NCTB Secondary 5.00*, *Madrasah Dakhil/Alim*,
   *NU Honours 4.00*, *Primary 4-Tier*).
2. Keyboard-first `@tanstack/react-table` grid: arrows/Enter/Tab nav, `A` toggles
   absent, over-max → red border + blocked save, live converted preview.
3. Process console: pre-flight checklist + live stage progress (`Aggregating CTs →
   Merging Papers → Computing GPA → Ranking Merit`) polled from the job endpoint.
4. Print: A4 marksheet (`id="printable-marksheet-area"`, merged 1st/2nd paper
   `rowSpan={2}`, grading legend top-right, QR, signature blocks) and A3/Legal
   landscape tabulation via `printElement`/`PrintMenu`.

**Acceptance**
- [ ] Marksheet renders `rowSpan={2}` for merged papers: individual CQ/MCQ per row;
      Total, grade and GP span both rows.
- [ ] Print layouts fit A4 portrait / Legal landscape without awkward page breaks.
- [ ] Every filter row uses `SearchSelect`/`DatePickerField`, 30 px controls,
      `rounded-xs` (per `AGENTS.md`).

---

## 7. Test matrix

| ID | Fixture | Expected |
| --- | --- | --- |
| T1 | 5×A+ + A + 4th A+ | GPA 4.83 → final 5.00 |
| T2 | Physics MCQ 7/25 (pass 8) | F / 0.00 / FAILED_MCQ |
| T3 | Bangla CQ 18+30 / 140 (pass 46) | pass |
| T4 | 4×4cr + 1×2cr lab | CGPA 3.56 |
| T5 | `79.5%` subject | A (4.00), no gap |
| T6 | 4th subject F | `failed_subject_count = 0`, still PASSED |
| T7 | Compulsory F | GPA 0.00 / F / FAILED |
| T8 | All absent | subject ABSENT, result FAILED |
| T9 | `BEST_N_AVERAGE`, N=2, k=3, unequal maxima | normalise-then-scale value |
| T10 | Readmit / re-run twice | identical snapshots, 1 active job |
| T11 | `min_courses_to_promote` met with 1 F (4.00) | PROMOTED_WITH_F |
| T12 | Primary descriptive scale | tier letter, no GPA, no F |
| T13 | Exempted component | max reduced, excluded from pass |
| T14 | Marks 100 × 4 in one tx | `< 300 ms` |
| T15 | 500-student tabulation | `< 500 ms`, no recalc |

---

## 8. Verification commands

```bash
pnpm migration:run          # Phase 1
pnpm migration:revert && pnpm migration:run
pnpm --filter api seed:results
pnpm --filter api build     # TS + entity registry sanity
pnpm lint
pnpm dev                    # manual E2E: configure → enter → process → print
```

Unit tests target `decimal-math`, `grade-lookup`, `rounding`, and the 8 stages.
(The repo has no test runner configured yet — see Q7; if unapproved, the T1–T15
assertions ship as a runnable `scripts/verify-result-engine.ts` seed fixture.)

---

## 9. Risk register & open questions

| # | Question | Recommended default |
| --- | --- | --- |
| Q1 | Scope now: full 7 phases, or backend (P1–P6) first then UI (P7)? | **P1→P6 first**, then P7 — the engine is the risk; UI is mechanical. |
| Q2 | Async engine: in-DB job table + in-process runner vs. install Redis+BullMQ? | **In-DB runner** (AD-2); lift to BullMQ later without algorithm change. |
| Q3 | Build an academic calendar module, or derive session/class/section options from existing enrollment data? | **Derive** (AD-3); calendar is a separate feature. |
| Q4 | Attendance: add `student_attendance_summaries` + manual/CSV entry now, or defer `AUTO_FROM_ATTENDANCE`? | **Add table + manual entry now** (AD-4); auto-pull when attendance module lands. |
| Q5 | Primary/Pre-Play pass rule: `min_pass_percentage` per scale (Board 33 / NU 40 / Primary 40) vs. no-fail descriptive? | **Configurable `min_pass_percentage`**, Primary default 40 (change to 0 for no-fail schools). |
| Q6 | CT aggregation formula: confirm normalise-then-scale (AD-8/CC-06). | **Confirm** — reduces to the source plan's averages when CT maxima are equal. |
| Q7 | Cumulative-annual weighting (Stage 7): implement in this delivery or phase it after core 5.00/4.00? | **Implement after T1–T8 green**; still in P5, guarded by `exam_term_weights`. |
| Q8 | Postgres portability: existing migrations use MySQL-only `(UUID())` defaults. Keep repo consistency now, or introduce `gen_random_uuid()` branch? | **Keep repo consistency** now; track as separate portability task. |
| Q9 | Add `exam_controller` role + seeded user (AD-9)? | **Yes** — nav already expects it. |
| Q10 | Should the public `/result/exam-result` mock lookup be rewired to real published results? | **Out of scope** for this delivery; note as follow-up. |

**Risks:** (1) results depend on hand-typed session/class UUIDs until a calendar
module exists (AD-3); (2) no test runner means regression safety relies on the
verify script unless Q7 is approved; (3) cumulative-annual (CC-11) is the least
specified rule and is isolated to its own guarded path.
