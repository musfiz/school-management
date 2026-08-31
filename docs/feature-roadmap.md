# Feature Roadmap — Bangladeshi School/College/Madrasa Management Platform

> Status: **planning** — no implementation has started. Review and confirm a
> phase before work begins.

## Scope decisions

- Single-tenant deployment (not multi-tenant SaaS), but the academic data
  model is generic enough to fit a **school (primary/secondary), college (up
  to HSC), madrasa (Alia/Qawmi), or coaching center with multiple branches** —
  all under one institution.
- No online payment gateway (bKash/Nagad/SSLCommerz) — fees tracked/recorded
  manually.
- No SMS gateway — email + in-app notifications only.
- Public website and dashboard (core ops) are built together, phase by phase.

## Current state (audit summary)

- `apps/web`: 31+ public pages scaffolded (content-block CMS), dashboard
  shell/nav/overview all using **mock data**, 5 roles (admin, management,
  teacher, student, guardian).
- `apps/api`: only a `User` entity + auth (JWT) + user CRUD. No
  Student/Teacher/Class/Result/Notice/Attendance/Fee entities or endpoints
  yet.
- `packages/shared-types`: 2 unused placeholder interfaces — not yet the
  contract layer it should be.
- Known infra bugs (`docs/project-analysis.md`): TypeORM entity glob breaks
  in production `dist/`, `synchronize: true` risk, API strict mode off, no
  `test`/`typecheck` turbo tasks.

## Dependency order

Phase 0 → 1 → 2 are strictly sequential. Phases 3, 5, 6, 7 can proceed in
parallel once Phase 2 is done. Phase 4 depends on Phase 2 (needs
students+classes) but not on 3/5/6/7. Phase 8 can start in parallel with
almost everything except the admission→enrollment link (needs Phase 2).
Phases 9–11 are last.

---

## Phase 0 — Foundation Fixes (do first, blocks everything else)

**Backend**
1. Fix `apps/api/src/database/data-source.ts` entity/migration glob —
   currently `src/database/migrations/*.ts` resolves only against source,
   breaking `dist/` production builds. Switch to an environment-aware glob
   (`.ts` in dev, `.js` in prod) or compile-safe absolute path resolution.
2. Keep `synchronize: false` permanently — add a startup assertion that
   throws if `NODE_ENV=production` and `synchronize` is ever true.
3. Enable TypeScript `strict: true` in `apps/api/tsconfig.json`; fix
   resulting type errors.
4. Add `test` and `typecheck` tasks to `turbo.json` (currently missing — CI
   only lints/builds).
5. Add `@nestjs/throttler` for basic rate limiting on `/auth/login` and
   `/auth/register`.

**Frontend**
1. Add `typecheck` script to `apps/web/package.json` (`tsc --noEmit`) and
   wire into the new turbo `typecheck` task.
2. No new pages this phase — purely tooling parity with backend.

**Exit criteria:** `pnpm build` succeeds from a clean `dist/` run of the API
(not just `ts-node`), `pnpm typecheck` passes both apps.

---

## Phase 1 — Core Academic Structure

**Backend — new entities** (`apps/api/src/database/entities/`)
- `Institution` — name, address, EIIN (Bangladesh institution ID), logo,
  established year.
- `Branch` — belongs to Institution; name, address, is_main_branch.
- `AcademicYear` — year label (e.g. "2026"), start/end date, is_current.
- `AcademicLevel` — enum-like entity: `school | college | madrasa_alia |
  madrasa_qawmi | coaching`; lets Class/Subject scope correctly per level.
- `SchoolClass` (named to avoid clashing with JS `Class`) — name (Class 6,
  HSC 1st Year, Hifz 2nd Year), academic level FK, numeric order for
  sorting.
- `Section` — name (A/B/Gulap/Golap), belongs to SchoolClass + Branch.
- `Group` — Science/Arts/Commerce/Business Studies, applies to college-level
  classes only (nullable FK on enrollment).
- `Shift` — Morning/Day/Evening.
- `Subject` — name, code, is_optional, applicable AcademicLevel(s),
  full-mark/pass-mark defaults.
- `ClassSubject` (join entity) — which subjects apply to which SchoolClass +
  Group combination (handles 4th subject / optional subject rules later in
  Phase 4).

**Backend — module & endpoints** (`apps/api/src/academic/`)
- CRUD endpoints for each of the above, all `admin`-only for write,
  `admin+management` for read.
- `GET /academic/classes?level=college` — filtered list for dropdowns.
- Migration files for all new tables (Laravel-style naming via
  `migration:make`).

**Frontend**
- New dashboard section **"Academic Setup"** (admin-only nav group in
  `dashboard-nav.ts`):
  - `/dashboard/academic/institution` — edit institution/branch profile.
  - `/dashboard/academic/classes` — manage classes/sections/groups/shifts
    (table + create/edit modal).
  - `/dashboard/academic/subjects` — manage subjects + class-subject
    mapping.
- Shared dropdown components: `ClassSelect`, `SectionSelect`,
  `AcademicYearSelect` (used across later phases' forms).
- Update `packages/shared-types` with `Institution`, `Branch`,
  `SchoolClass`, `Section`, `Group`, `Subject` DTOs so both apps share one
  contract.

**Exit criteria:** Admin can fully configure the institution's academic
structure through the dashboard with no hardcoded values left in
`dashboard-nav.ts`/`dashboard-overview.ts` related to structure.

---

## Phase 2 — People (Students, Teachers, Guardians)

**Backend — new entities**
- `Student` — links to `User` (1:1, for login), admission number, roll
  number (unique per class+section+year), date of birth, NID/Birth
  Certificate No., blood group, religion, present/permanent address
  (Village/Union/Upazila/District/Division fields), admission date, status
  (active/transferred/graduated/dropped).
- `Teacher` — links to `User`, designation, subject specialization(s),
  joining date, qualification, NID, salary grade (structure only, no
  payroll processing yet).
- `Guardian` — links to `User` (optional login), relation (father/
  mother/other), occupation, NID, contact number.
- `StudentGuardian` (join) — student ↔ guardian(s), supports multiple
  guardians per student.
- `Enrollment` — student ↔ AcademicYear ↔ SchoolClass ↔ Section ↔ Group ↔
  Shift (one row per year; lets a student's class change year to year
  without losing history).

**Backend — module & endpoints** (`apps/api/src/students/`,
`apps/api/src/teachers/`, `apps/api/src/guardians/`)
- Full CRUD, plus:
  - `GET /students?class=&section=&year=` — filtered/paginated list.
  - `POST /students/:id/promote` — bulk promotion to next class/year.
  - `GET /students/:id/guardians`, `POST /students/:id/guardians`.
- Extend `RolesGuard` checks: teachers can only read students in their
  assigned classes (needs a `TeacherClassAssignment` join entity too).

**Frontend**
- `/dashboard/students` — replace stub with real list (filters:
  class/section/year), add/edit form, student profile page
  (`/dashboard/students/[id]`) showing enrollment history, guardians,
  attendance/result tabs (populated in later phases).
- `/dashboard/teachers` — replace stub similarly; teacher profile with
  assigned classes/subjects.
- New `/dashboard/guardians` page (list guardians, link/unlink students).
- Guardian-role dashboard: guardian's `/dashboard` overview shows linked
  children (multi-child support if more than one).
- Replace `mock-users.ts` usage with real API calls behind a feature flag
  until Phase 2 is fully wired.

**Exit criteria:** Real students/teachers/guardians can be created,
enrolled, and viewed end-to-end; dashboard no longer uses `mock-users.ts`
for these roles.

---

## Phase 3 — Attendance

**Backend**
- `StudentAttendance` — student, date, status (present/absent/late/
  excused), marked_by (teacher), section context.
- `TeacherAttendance` — teacher, date, status, marked_by (admin).
- `apps/api/src/attendance/` module:
  - `POST /attendance/students/bulk` — mark a whole section's attendance
    for a date in one request.
  - `GET /attendance/students?class=&section=&month=` — monthly grid.
  - `GET /attendance/summary/student/:id` — % present for dashboard stats.

**Frontend**
- `/dashboard/attendance` (new nav item, teacher+admin):
  - Daily entry grid — pick class/section/date, checkbox/radio per
    student, submit.
  - Monthly summary view per student/class.
- Student/Guardian dashboard overview card switches from mock "92%
  attendance" to real computed value via
  `GET /attendance/summary/student/:id`.

**Exit criteria:** Teachers mark daily attendance; dashboard attendance
stats are real for at least one full month of data.

---

## Phase 4 — Exams & Results

**Backend**
- `ExamType` — Class Test, Half-Yearly, Annual, Test/Selection Exam,
  Pre-Test, SSC/HSC Board (enum-like entity, configurable).
- `Exam` — ExamType + AcademicYear + SchoolClass + date range.
- `ExamSubjectSchedule` — exam ↔ subject ↔ date/time/full marks/pass
  marks.
- `Mark` — student ↔ exam-subject-schedule ↔ marks obtained ↔ entered_by
  (teacher) ↔ locked flag (prevents edits after publish).
- `GradeScale` — configurable grade boundaries (NCTB default: 80+=A+,
  70-79=A, 60-69=A-, 50-59=B, 40-49=C, 33-39=D, <33=F) — stored as data,
  not hardcoded, so it can be adjusted per level (school vs madrasa vs
  college). **Needs your confirmation on the exact rule/4th-subject bonus
  logic before implementation.**
- `ResultCalculationService` — computes subject grade, GPA, overall grade
  per NCTB rules (with 4th subject bonus point handling), generates a
  `ReportCard` record (cached calculated result) per student per exam.
- `apps/api/src/exams/` module:
  - Admin/teacher: create exam, schedule subjects, enter/edit marks (bulk
    entry per class-subject).
  - `POST /exams/:id/publish` — locks marks, triggers GPA calculation,
    generates report cards.
  - `GET /results/public?class=&roll=&year=` — **public, unauthenticated**
    endpoint backing the existing `ResultLookup` component.
  - `GET /results/student/:id` — authenticated, full history for
    student/guardian dashboard.

**Frontend**
- `/dashboard/exams` (new nav item) — exam calendar, create exam, schedule
  subjects.
- `/dashboard/exams/[id]/marks` — bulk marks entry grid (class × subject),
  teacher-only, with save-draft vs publish states.
- `/dashboard/results` — replace stub: student/guardian sees own report
  cards (downloadable PDF); teacher/admin sees class-wide result summary
  with pass-rate stats.
- Rewire `apps/web/src/components/ResultLookup.tsx` and the result API
  route to call the new public `/results/public` API instead of
  static/mock data.
- Report card PDF generation — likely `@react-pdf/renderer` or
  server-side PDF via a NestJS endpoint (`GET /results/:id/pdf`).

**Exit criteria:** A full exam cycle can be run: create exam → schedule
subjects → enter marks → publish → public result lookup and dashboard both
show correct GPA/grades.

**⚠️ Needs your input before backend work starts:** exact NCTB grading
boundaries/4th-subject bonus rule, and whether madrasa levels need a
separate (non-GPA) grading scheme.

---

## Phase 5 — Fees & Accounts (manual, no gateway)

**Backend**
- `FeeHead` — fee category (Tuition, Exam Fee, Session Fee, Transport,
  etc.).
- `FeeStructure` — FeeHead ↔ SchoolClass ↔ AcademicYear ↔ amount ↔ due
  date.
- `Invoice` — generated per student per fee structure per month/term,
  status (unpaid/partial/paid/waived).
- `Payment` — invoice ↔ amount ↔ method (cash/bank/bKash-manual-
  reference/cheque) ↔ received_by ↔ receipt number ↔ date. (No live
  gateway — this is a manual ledger entry with an optional reference
  number field for mobile banking transaction IDs.)
- `apps/api/src/fees/` module:
  - `POST /fees/structures`, `POST /fees/invoices/generate` (bulk generate
    for a class/month).
  - `POST /fees/invoices/:id/payments` — record a manual payment.
  - `GET /fees/dues?class=&section=` — defaulters report.

**Frontend**
- `/dashboard/fees` (new nav item, admin/management):
  - Fee structure setup per class/year.
  - Invoice generation (bulk button per class/month).
  - Payment recording form (per student, per invoice).
  - Dues/defaulter report table with export (CSV).
- Student/Guardian dashboard: "My Fees" tab showing invoice history and
  outstanding dues (read-only).

**Exit criteria:** Admin can set up fees for a class, generate monthly
invoices, record payments manually, and see a dues report. No payment
gateway code is written.

---

## Phase 6 — Notices & Communication

**Backend**
- Extend the currently static notice content into a real `Notice` entity:
  title, body, category (admission/exam/general/urgent), target audience
  (all/role/specific class/specific branch), pinned, publish/expiry dates,
  created_by.
- `apps/api/src/notices/` module — CRUD (admin/management/teacher can
  create depending on target scope), `GET /notices/public`
  (unauthenticated, feeds the homepage ticker), `GET /notices?role=&class=`
  (authenticated, dashboard-filtered).
- Email digest job (NestJS `@nestjs/schedule` cron) — daily/weekly summary
  email to guardians of new notices affecting their child's class. Uses a
  simple SMTP/email provider (e.g. Nodemailer + provider like
  SendGrid/Mailgun free tier) — no SMS.

**Frontend**
- `/dashboard/notices` — replace stub: create/edit form with
  target-audience picker, list with filters.
- Homepage `NoticeTicker` component switches from static content
  collection to `GET /notices/public`.
- `/others/notices` public page wired to the same public endpoint
  (paginated).

**Exit criteria:** Notices are created via dashboard and appear both on
the public homepage ticker and in the dashboard notice list without any
static content file edits.

---

## Phase 7 — Library, Routine/Timetable, Homework

**Backend**
- `Book`, `BookIssue` (issue/return tracking, due dates, fine calculation
  — manual, no payment gateway).
- `RoutinePeriod` — class/section ↔ day-of-week ↔ period-number ↔ subject
  ↔ teacher ↔ start/end time — powers a real class timetable.
- `Homework` — class/section/subject ↔ description ↔ assigned date ↔ due
  date ↔ attachment.
- Three small modules: `apps/api/src/library/`, `apps/api/src/routine/`,
  `apps/api/src/homework/`.

**Frontend**
- `/dashboard/library` — book catalog, issue/return workflow (librarian-
  capable admin role, or extend the `Roles` enum with `librarian` if
  needed).
- `/dashboard/routine` — timetable builder (grid: day × period), read-only
  view for students/teachers, edit for admin.
- `/dashboard/homework` — teacher posts homework per class/subject;
  students/guardians see a homework feed.
- Public `academic/class-schedule` page wired to the real routine data
  instead of static content.

**Exit criteria:** These three modules work independently; can be built in
any order or in parallel by different developers since they don't depend
on each other.

---

## Phase 8 — Public Website Buildout

**Backend**
- `AdmissionApplication` entity — public online admission form
  submissions (name, DOB, applying class, guardian contact, documents)
  with status (pending/reviewed/accepted/rejected). `apps/api/src/
  admissions/` module, `POST /admissions/apply` public endpoint, admin
  review endpoints.
- Reuse the `Notice` entity (category=news/events) instead of a separate
  News/Events entity — keeps the model simpler.
- `GalleryAlbum`/`GalleryImage` entities for the gallery section, with
  simple file upload (local disk or S3-compatible bucket — needs a
  decision on storage backend).
- `Download` entity (file, title, category) for the downloads page.

**Frontend**
- `/admission/registration-system` — real form posting to
  `/admissions/apply`, with confirmation screen.
- `/dashboard/admissions` — admin review queue (approve → auto-creates
  `Student` + `User` account; reject → notify applicant by email).
- `/others/gallery`, `/others/downloads`, `/others/news`, `/others/events`
  — wired to backend instead of static `ContentRenderer` blocks.
- **Bilingual support**: add `next-intl` (or similar) for Bangla/English
  toggle across public pages — this is a cross-cutting change touching
  layout, navigation, and all content components. Recommended to start
  early in Phase 8, not last, since retrofitting i18n later is expensive.

**Exit criteria:** A prospective student can apply online; admin can
review and convert to enrollment; public content pages are backend-driven
and bilingual.

---

## Phase 9 — Multi-Branch & Permissions Refinement

**Backend**
- Add `branch_id` scoping to `RolesGuard`/`current-user.decorator.ts` so
  branch-admins only see their branch's data (students, teachers, fees,
  notices).
- `POST /students/:id/transfer` — move student between branches/classes
  with an audit trail (`TransferHistory` entity).

**Frontend**
- Branch switcher in dashboard topbar (only visible if user has
  multi-branch access, e.g. super-admin).
- Transfer workflow UI on student profile page.

**Exit criteria:** A super-admin can manage multiple branches; a
branch-scoped admin cannot see other branches' data.

---

## Phase 10 — Reporting & Analytics

**Backend**
- Aggregation endpoints: `GET /reports/attendance-summary`,
  `GET /reports/result-summary`, `GET /reports/fee-collection`,
  `GET /reports/enrollment-trend` — likely raw SQL/query-builder for
  performance rather than ORM entity loading.

**Frontend**
- Replace every hardcoded number in `dashboard-overview.ts` with real
  API-backed values.
- Add simple charts (e.g. `recharts`) to admin/management overview:
  attendance trend, pass-rate trend, fee collection vs dues, enrollment by
  class.

**Exit criteria:** Zero hardcoded statistics remain in the dashboard; all
numbers come from live queries.

---

## Phase 11 — Hardening & Deployment

**Backend**
- Audit log entity (who changed marks/fees/student records, when) for
  accountability — important for exam result integrity disputes.
- `@nestjs/throttler` extended to all write endpoints, not just auth.
- Docker: `output: 'standalone'` for `apps/web`, multi-stage Dockerfile for
  `apps/api`.
- Backup strategy doc for MySQL (mysqldump cron or managed DB snapshots).

**Frontend**
- Error boundary coverage audit (currently only `(protected)/error.tsx`
  exists — check public routes too).
- Basic accessibility pass (form labels, keyboard nav in dashboard
  tables).

**Exit criteria:** CI runs lint + typecheck + test + build; production
deployment is documented and reproducible via `pnpm install && pnpm build`.

---

## Cross-cutting notes

- Every new entity gets a matching Laravel-style migration via
  `pnpm migration:make <name>` (already set up).
- `packages/shared-types` becomes the single source of truth for DTOs
  shared between `apps/api` and `apps/web` — currently unused, should stop
  being unused starting Phase 1.

## Open questions before implementation begins

1. Exact NCTB GPA grade boundaries + 4th-subject bonus rule you want
   (Phase 4).
2. Whether madrasa levels need a separate non-GPA grading scheme, or reuse
   NCTB-style grading (Phase 4).
3. File storage backend for gallery/documents/downloads — local disk vs
   S3-compatible bucket (Phase 8).
4. Email provider preference for notice digests/admission notifications
   (Phase 6/8) — e.g. SMTP via existing hosting, SendGrid, Mailgun.
5. Whether a `librarian` role is needed (Phase 7) or admin handles the
   library too.
