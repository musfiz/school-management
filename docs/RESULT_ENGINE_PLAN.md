# MASTER AGENT IMPLEMENTATION PLAN & TECHNICAL DESIGN SPEC:
## Bangladesh Dynamic Academic Result & Grading Engine (Pre-Play to Honours/Kamil)

## 1. System Context & Architectural Mandate
You are implementing a 100% configurable, rule-driven **Academic Examination, Grading, and Result Processing Engine** for an educational ERP in Bangladesh. It must support:
1. **Pre-Primary & Primary:** Pre-Play to Class 5 (General, English Version, and Madrasah Ibtedayi) — supporting both 5.00 GPA, 4-Tier Primary Grading (`A, B, C, D`), and Descriptive/Competency remarks.
2. **Secondary:** Class 6 to 10 / SSC / Dakhil / Vocational — supporting NCTB & Madrasah Board 5.00 GPA, Combined 1st & 2nd Paper rules (e.g., Bangla & English), separate component pass (`CQ`, `MCQ`, `Practical`), and 4th Subject Bonus GP (`GP - 2.00`).
3. **Higher Secondary:** Class 11 & 12 / HSC / Alim — supporting dual-paper subjects across all streams (Science, Humanities, Business, General, Muzabbid), strict component-level pass, and 4th subject bonus.
4. **Tertiary / Higher Education (Internal Institute Exams):** Degree (Pass), Honours, Masters, Fazil, and Kamil (following National University [NU] & Islamic Arabic University [IAU] 4.00 Credit-Weighted CGPA standards, Incourse + Attendance + Term Final splits, and course promotion rules).

### Tech Stack & Strict Portability Constraints
- **Backend:** NestJS (TypeScript, Modular Architecture, `@nestjs/bullmq` or background worker for batch result generation, `decimal.js` for exact floating-point math).
- **Database:** MariaDB 10.6+ / MySQL 8.0+ with **100% ANSI/PostgreSQL Portability** (use `DECIMAL(8,2)` for marks/GPA, `VARCHAR` backed by TypeScript Enums, standard ANSI joins, and zero MariaDB-only functions).
- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS, `shadcn/ui`, `@tanstack/react-table` for Excel-like keyboard mark entry, `react-hook-form` + `zod`).

---

## 2. Target Directory Structure

### Backend (`apps/api/src/modules/academic-results/`)
```text
src/modules/academic-results/
├── grading-scales/           # 5.00, 4.00, & Custom Grading Scales + Attendance Slabs
├── syllabus-config/          # Class Subjects, Combined Paper Mergers, Student Subject Enrollment (Compulsory/4th)
├── exam-setup/               # Exam Terms, Sub-Exams (CT/Incourse), Component Distributions (CQ/MCQ/Prac)
├── marks-entry/              # Teacher Spreadsheet Bulk Upsert, Absent/Exemption Handling, CSV/OMR Import
├── calculation-engine/       # The 8-Stage Deterministic Calculation Pipeline & BullMQ Processor
├── reports-transcripts/      # Progress Reports, Broadsheet Tabulation, Merit List, Subject Analytics
└── common/                   # Rounding helpers, Tie-breaker comparator, Decimal math utilities
```

### Frontend (`apps/web/src/app/(dashboard)/academic-results/`)
```text
src/app/(dashboard)/academic-results/
├── settings/
│   ├── grading-scales/       # Grading Scale & Attendance Slab Builder
│   └── syllabus-matrix/      # Class-wise Subject Roles & 1st/2nd Paper Merger Matrix
├── exams/
│   ├── [examId]/components/  # CQ, MCQ, Practical, CT weight & pass-mark grid
│   └── [examId]/process/     # Pre-flight validation checklist & Live Result Generation Progress
├── marks-entry/              # High-speed keyboard spreadsheet grid for teachers + CSV upload
└── outputs/
    ├── marksheets/           # Batch printable Student Progress Reports / Transcripts (A4 + QR)
    ├── tabulation-sheet/     # Master Landscape Broadsheet (A3/Legal) for Exam Committee
    └── merit-analytics/      # Merit list, Fail list, & Teacher Subject Performance analytics
```

---

## 3. Portable Relational Database Schema (MariaDB & PostgreSQL Ready)

Implement the following 11 core tables in your ORM (Prisma or TypeORM).

```sql
-- =========================================================================
-- 1. GRADING SCALES, RANGES & ATTENDANCE SLABS
-- =========================================================================

CREATE TABLE grading_scales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                 -- e.g., 'NCTB/Madrasah 5.00 Scale', 'NU/IAU Honours 4.00 Scale'
    scale_type VARCHAR(30) NOT NULL,            -- 'GPA_5', 'CGPA_4', 'DESCRIPTIVE_ONLY'
    max_point DECIMAL(4, 2) NOT NULL,           -- 5.00 or 4.00
    min_pass_point DECIMAL(4, 2) NOT NULL,      -- 1.00 (Board 5.00) or 2.00 (NU 4.00)
    fourth_subject_deduction DECIMAL(4, 2) DEFAULT 2.00, -- Deducted from 4th subject GP (Board = 2.00)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grading_scale_ranges (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    grading_scale_id BIGINT NOT NULL REFERENCES grading_scales(id) ON DELETE CASCADE,
    min_percentage DECIMAL(5, 2) NOT NULL,      -- e.g., 80.00
    max_percentage DECIMAL(5, 2) NOT NULL,      -- e.g., 100.00
    letter_grade VARCHAR(10) NOT NULL,          -- 'A+', 'A', 'A-', 'B', 'C', 'D', 'F'
    grade_point DECIMAL(4, 2) NOT NULL,         -- 5.00, 4.00, 3.75, 0.00
    descriptive_remark VARCHAR(100)             -- 'Outstanding', 'Satisfactory', 'Needs Improvement'
);

CREATE TABLE attendance_mark_slabs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                 -- e.g., 'NU Honours 5-Mark Attendance Slab'
    min_attendance_pct DECIMAL(5, 2) NOT NULL,  -- e.g., 90.00
    max_attendance_pct DECIMAL(5, 2) NOT NULL,  -- e.g., 100.00
    awarded_marks DECIMAL(5, 2) NOT NULL        -- e.g., 5.00
);

-- =========================================================================
-- 2. MASTER SUBJECTS, CLASS SYLLABUS & STUDENT SUBJECT ENROLLMENT
-- =========================================================================

CREATE TABLE academic_subjects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subject_code VARCHAR(30) NOT NULL,          -- '101' (Bangla 1st), '102' (Bangla 2nd), '241101' (Honours)
    subject_name VARCHAR(150) NOT NULL,
    board_stream VARCHAR(30) NOT NULL,          -- 'GENERAL', 'MADRASAH', 'VOCATIONAL', 'TERTIARY_NU_IAU'
    paper_number INT DEFAULT 1                  -- 1, 2, or NULL
);

CREATE TABLE class_syllabus_subjects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    academic_session_id BIGINT NOT NULL,
    class_or_dept_id BIGINT NOT NULL,           -- Links to Class (Play..12) or Dept/Year (BBA 1st Year, Fazil)
    subject_id BIGINT NOT NULL REFERENCES academic_subjects(id),
    combined_group_code VARCHAR(40),            -- e.g., 'BANGLA', 'ENGLISH', 'PHYSICS' (NULL if standalone)
    combined_group_name VARCHAR(100),           -- e.g., 'Bangla (1st & 2nd Paper)'
    default_subject_role VARCHAR(30) NOT NULL,  -- 'COMPULSORY', 'GROUP_ELECTIVE', 'FOURTH_OPTIONAL', 'NON_CREDIT'
    credit_hours DECIMAL(4, 2) DEFAULT 0.00,    -- 0.00 for Schools; 4.00 / 3.00 / 1.50 for Honours/Fazil
    full_marks DECIMAL(6, 2) NOT NULL,          -- 100.00, 50.00
    pass_evaluation_mode VARCHAR(40) NOT NULL DEFAULT 'SEPARATE_COMPONENTS',
    -- Allowed values:
    -- 'TOTAL_MARKS_ONLY'          (Pre-Play to Class 5: only total subject mark needs 33%)
    -- 'SEPARATE_COMPONENTS'       (SSC/HSC Science/Madrasah: must pass CQ, MCQ, Prac in THIS paper)
    -- 'COMBINED_PAPER_COMPONENTS' (SSC/HSC Bangla/English: sum of Paper1+Paper2 CQ >= pass, sum of MCQ >= pass)
    display_order INT DEFAULT 1
);

-- Tracks which specific subjects are Compulsory vs 4th Subject for an individual student
CREATE TABLE student_subject_enrollments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    academic_session_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    syllabus_subject_id BIGINT NOT NULL REFERENCES class_syllabus_subjects(id),
    assigned_role VARCHAR(30) NOT NULL,         -- 'COMPULSORY', 'FOURTH_OPTIONAL', 'NON_CREDIT'
    UNIQUE KEY uq_student_sub_enroll (academic_session_id, student_id, syllabus_subject_id)
);

-- =========================================================================
-- 3. EXAM TERMS, SUB-EXAMS (CT/INCOURSE) & COMPONENT DISTRIBUTIONS
-- =========================================================================

CREATE TABLE exam_terms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    academic_session_id BIGINT NOT NULL,
    class_or_dept_id BIGINT NOT NULL,
    grading_scale_id BIGINT NOT NULL REFERENCES grading_scales(id),
    term_name VARCHAR(100) NOT NULL,            -- '1st Term', 'Test Exam', 'Honours 2nd Yr Final'
    term_type VARCHAR(30) NOT NULL,             -- 'SUB_EXAM_CT', 'TERMINAL', 'CUMULATIVE_ANNUAL'
    parent_terminal_exam_id BIGINT REFERENCES exam_terms(id), -- Populated if this is a CT/Incourse feeding a Term
    ct_aggregation_mode VARCHAR(30) DEFAULT 'BEST_N_AVERAGE',
    -- Allowed: 'BEST_N_AVERAGE', 'BEST_N_SUM', 'ALL_AVERAGE', 'WEIGHTED_SUM'
    ct_best_count INT DEFAULT 2,
    annual_weight_pct DECIMAL(5, 2) DEFAULT 100.00, -- e.g., 25.00% Half-Yearly + 75.00% Annual
    mark_rounding_mode VARCHAR(20) DEFAULT 'HALF_UP_INTEGER', -- 'HALF_UP_INTEGER', 'CEILING_INTEGER', 'TWO_DECIMALS'
    min_courses_to_promote INT DEFAULT 0,       -- Used for NU Honours/Degree conditional promotion
    min_cgpa_to_promote DECIMAL(4, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'SETUP'          -- 'SETUP', 'MARKS_ENTRY', 'PROCESSING', 'PUBLISHED', 'LOCKED'
);

CREATE TABLE exam_subject_components (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_term_id BIGINT NOT NULL REFERENCES exam_terms(id) ON DELETE CASCADE,
    syllabus_subject_id BIGINT NOT NULL REFERENCES class_syllabus_subjects(id),
    component_code VARCHAR(30) NOT NULL,        -- 'CT_INCOURSE', 'ATTENDANCE', 'CQ_WRITTEN', 'MCQ', 'PRACTICAL', 'VIVA'
    component_name VARCHAR(60) NOT NULL,
    source_type VARCHAR(30) DEFAULT 'MANUAL_ENTRY', -- 'MANUAL_ENTRY', 'AUTO_FROM_SUB_EXAMS', 'AUTO_FROM_ATTENDANCE'
    max_raw_marks DECIMAL(6, 2) NOT NULL,       -- e.g., 100.00 (Written exam taken on 100)
    conversion_weight_pct DECIMAL(5, 2) DEFAULT 100.00, -- e.g., 80.00% (Converts 100 raw to 80)
    converted_max_marks DECIMAL(6, 2) NOT NULL, -- e.g., 80.00
    min_pass_marks DECIMAL(6, 2) DEFAULT 0.00,  -- e.g., 26.00 (0.00 if component has no individual pass bar)
    display_order INT DEFAULT 1
);

-- =========================================================================
-- 4. RAW MARKS ENTRY & COMPUTED SNAPSHOT TABLES
-- =========================================================================

CREATE TABLE student_component_marks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_term_id BIGINT NOT NULL REFERENCES exam_terms(id),
    student_id BIGINT NOT NULL,
    syllabus_subject_id BIGINT NOT NULL REFERENCES class_syllabus_subjects(id),
    component_id BIGINT NOT NULL REFERENCES exam_subject_components(id),
    raw_marks_obtained DECIMAL(6, 2) DEFAULT 0.00,
    converted_marks DECIMAL(6, 2) DEFAULT 0.00,
    is_absent BOOLEAN DEFAULT FALSE,
    is_exempted BOOLEAN DEFAULT FALSE,
    is_passed_component BOOLEAN DEFAULT TRUE,
    entered_by BIGINT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_student_exam_comp (exam_term_id, student_id, component_id)
);

CREATE TABLE student_subject_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_term_id BIGINT NOT NULL REFERENCES exam_terms(id),
    student_id BIGINT NOT NULL,
    syllabus_subject_id BIGINT REFERENCES class_syllabus_subjects(id), -- NULL if row is a Merged Group Summary
    combined_group_code VARCHAR(40),            -- Populated for merged result (e.g., 'BANGLA')
    is_merged_summary_row BOOLEAN DEFAULT FALSE,
    assigned_role VARCHAR(30) NOT NULL,         -- 'COMPULSORY', 'FOURTH_OPTIONAL', 'NON_CREDIT'
    credit_hours DECIMAL(4, 2) DEFAULT 0.00,
    full_marks DECIMAL(6, 2) NOT NULL,
    component_breakdown_json TEXT,              -- JSON snapshot: {"CT":18,"CQ":52,"MCQ":24,"PRAC":22}
    total_obtained_marks DECIMAL(6, 2) NOT NULL,
    highest_marks_in_class DECIMAL(6, 2) DEFAULT 0.00,
    percentage_marks DECIMAL(5, 2) NOT NULL,
    letter_grade VARCHAR(10) NOT NULL,
    grade_point DECIMAL(4, 2) NOT NULL,
    effective_gp_for_gpa DECIMAL(4, 2) NOT NULL, -- For 4th Subject: MAX(0, GP - 2.00)
    weighted_credit_points DECIMAL(6, 2) DEFAULT 0.00, -- GP * credit_hours (for Honours/Degree)
    is_passed BOOLEAN NOT NULL,
    fail_reason VARCHAR(100)                    -- 'FAILED_CQ', 'FAILED_MCQ', 'FAILED_PRACTICAL', 'ABSENT', 'BELOW_TOTAL'
);

CREATE TABLE student_term_marksheets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_term_id BIGINT NOT NULL REFERENCES exam_terms(id),
    student_id BIGINT NOT NULL,
    section_id BIGINT,
    shift_id BIGINT,
    total_compulsory_subjects INT NOT NULL,     -- Denominator for 5.00 GPA (after paper merging!)
    total_credits_attempted DECIMAL(5, 2) DEFAULT 0.00,
    total_credits_earned DECIMAL(5, 2) DEFAULT 0.00,
    marks_without_fourth DECIMAL(8, 2) NOT NULL,
    marks_with_fourth DECIMAL(8, 2) NOT NULL,
    gpa_without_fourth DECIMAL(4, 2) NOT NULL,
    fourth_subject_bonus_gp DECIMAL(4, 2) DEFAULT 0.00,
    final_gpa_or_cgpa DECIMAL(4, 2) NOT NULL,
    final_letter_grade VARCHAR(10) NOT NULL,
    failed_subject_count INT DEFAULT 0,
    attendance_percentage DECIMAL(5, 2) DEFAULT 100.00,
    result_status VARCHAR(30) NOT NULL,         -- 'PASSED', 'FAILED', 'PROMOTED_WITH_F', 'WITHHELD'
    merit_position_section INT,
    merit_position_class INT,
    merit_position_shift INT,
    principal_remark VARCHAR(255),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_term_marksheet (exam_term_id, student_id)
);
```

---

## 4. Core Mathematical & Algorithmic Specifications (Exact Logic for Agent)

The coding agent MUST implement these exact mathematical edge cases inside `ResultCalculationEngineService`:

### Rule 1: Sub-Exam (CT / Incourse) Aggregation
For any `exam_subject_components` where `source_type === 'AUTO_FROM_SUB_EXAMS'`:
1. Query all child `exam_terms` where `parent_terminal_exam_id = currentTerm.id`.
2. Fetch the student's `converted_marks` for the matching `syllabus_subject_id` across those N child exams. Treat `is_absent = true` as `0.00`.
3. Sort marks descending: $M_1 \ge M_2 \ge \dots \ge M_k$.
4. Compute raw aggregated score:
   - If `BEST_N_AVERAGE`: $\frac{1}{N} \sum_{i=1}^{N} M_i$ (scaled to `converted_max_marks`).
   - If `BEST_N_SUM`: $\sum_{i=1}^{N} M_i$.
   - If `ALL_AVERAGE`: $\frac{1}{k} \sum_{i=1}^{k} M_i$.

### Rule 2: Individual Paper vs. Combined 1st & 2nd Paper Evaluation
This is the most critical distinction in Bangladesh Education Boards:
- **Case A: Standalone Subject (`combined_group_code IS NULL`, e.g., Mathematics, Physics in SSC, Quran Mazid in Dakhil, or Honours Courses):**
  - Sum converted component marks: $T = \sum C_j$.
  - Apply rounding (`HALF_UP_INTEGER`, `CEILING_INTEGER`, or `TWO_DECIMALS`).
  - Pass check:
    - If `pass_evaluation_mode === 'SEPARATE_COMPONENTS'`: Every component $j$ must satisfy $C_j \ge \text{min\_pass\_marks}_j$ and `is_absent === false`.
    - Also verify $T \ge \text{Scale Min Pass Percentage}$.
  - If passed, lookup `grade_point` and `letter_grade` from `grading_scale_ranges` using $\text{Percentage} = \frac{T}{\text{full\_marks}} \times 100$.
- **Case B: Combined 1st & 2nd Paper Group (`combined_group_code IS NOT NULL`, e.g., SSC/HSC Bangla 1st & 2nd, English 1st & 2nd, HSC Physics 1st & 2nd):**
  - Store individual rows in `student_subject_results` for Paper 1 and Paper 2 (`is_merged_summary_row = false`) so the marksheet can display Paper 1 and Paper 2 marks side by side.
  - Create **one** merged summary row (`is_merged_summary_row = true`, `combined_group_code = 'BANGLA'`):
    - $\text{Combined Full Marks} = \text{Full}_1 + \text{Full}_2$ (e.g., $100 + 100 = 200$).
    - $\text{Combined Obtained} = T_1 + T_2$.
    - **Component Pass Check Mode:**
      - If `pass_evaluation_mode === 'COMBINED_PAPER_COMPONENTS'` (Standard Board rule for SSC/HSC Bangla & English):
        Sum matching component codes across Paper 1 and Paper 2:
        $$(\text{CQ}_1 + \text{CQ}_2) \ge (\text{MinPassCQ}_1 + \text{MinPassCQ}_2)$$
        $$(\text{MCQ}_1 + \text{MCQ}_2) \ge (\text{MinPassMCQ}_1 + \text{MinPassMCQ}_2)$$
      - If `pass_evaluation_mode === 'SEPARATE_COMPONENTS'` (Standard Board rule for HSC Science subjects like Physics 1st & 2nd):
        Both Paper 1 AND Paper 2 must independently pass all their own `CQ`, `MCQ`, and `PRACTICAL` minimums!
    - **Crucial GPA Denominator Rule:** When counting `total_compulsory_subjects` for GPA calculation, a merged 1st+2nd paper group counts as **1 subject** (NOT 2), whereas standalone papers (like Dakhil Arabic 1st and Arabic 2nd when not merged) count as **2 subjects**.

### Rule 3: 4th Subject (Optional Subject) Bonus & Fail Immunity
For any subject where `student_subject_enrollments.assigned_role === 'FOURTH_OPTIONAL'`:
1. **Fail Immunity:** If the student fails the 4th subject (`is_passed === false` or `grade_point === 0.00`), DO NOT increment `failed_subject_count`. The student still passes the exam if all compulsory subjects are passed.
2. **Bonus GP Calculation:**
   $$\text{effective\_gp\_for\_gpa} = \max(0.00, \text{grade\_point} - \text{grading\_scales.fourth\_subject\_deduction})$$
   *(Under NCTB & Madrasah Board, `fourth_subject_deduction = 2.00`. So an `A+` [5.00] in Higher Math / Agriculture adds `3.00` bonus points to the total GP numerator).*

### Rule 4: Final GPA (5.00) vs. Credit-Weighted CGPA (4.00)
- **If `scale_type === 'GPA_5'`:**
  - If `failed_subject_count > 0` (in `COMPULSORY` subjects):
    - `gpa_without_fourth = 0.00`, `final_gpa_or_cgpa = 0.00`, `final_letter_grade = 'F'`, `result_status = 'FAILED'`.
  - Else (`failed_subject_count === 0`):
    - Let $N_{\text{comp}}$ = count of evaluated compulsory subjects/merged-groups.
    - $\text{gpa\_without\_fourth} = \text{round}\left(\frac{\sum \text{GP}_{\text{comp}}}{N_{\text{comp}}}, 2\right)$
    - $\text{final\_gpa\_or\_cgpa} = \min\left(5.00, \text{round}\left(\frac{\sum \text{GP}_{\text{comp}} + \text{fourth\_subject\_bonus\_gp}}{N_{\text{comp}}}, 2\right)\right)$
    - Lookup `final_letter_grade` from `grading_scale_ranges` by matching `final_gpa_or_cgpa` against `grade_point` thresholds:
      - $5.00 \rightarrow \text{A+}$, $[4.00, 4.99] \rightarrow \text{A}$, $[3.50, 3.99] \rightarrow \text{A-}$, $[3.00, 3.49] \rightarrow \text{B}$, $[2.00, 2.99] \rightarrow \text{C}$, $[1.00, 1.99] \rightarrow \text{D}$.
- **If `scale_type === 'CGPA_4'` (Honours / Degree / Fazil / Kamil):**
  - For each course $i$, $\text{weighted\_credit\_points}_i = \text{GP}_i \times \text{credit\_hours}_i$.
  - $\text{total\_credits\_attempted} = \sum \text{credit\_hours}_i$.
  - $\text{total\_credits\_earned} = \sum_{\text{passed}} \text{credit\_hours}_i$.
  - $\text{final\_gpa\_or\_cgpa} = \text{round}\left(\frac{\sum \text{weighted\_credit\_points}_i}{\text{total\_credits\_attempted}}, 2\right)$.
  - **Conditional Promotion Check (NU/IAU Rule):** Even if `failed_subject_count > 0`, if `exam_terms.min_courses_to_promote > 0` and passed courses $\ge \text{min\_courses\_to\_promote}$ AND $\text{final\_gpa\_or\_cgpa} \ge \text{min\_cgpa\_to\_promote}$, set `result_status = 'PROMOTED_WITH_F'`.

---

## 5. Step-by-Step Execution Phases for the Working Agent

Execute these **7 Phases** in order. Verify all acceptance tests at the end of each phase before moving to the next.

---

### PHASE 1: Database Migrations & Master Bangladesh Curriculum Seeder
**Objective:** Create all 11 relational tables and seed standard Bangladesh presets.

#### Tasks:
1. Generate ORM entities/migrations for the 11 tables in Section 3.
2. Create `seed-academic-results.ts` to pre-populate:
   - **Grading Scale 1:** `NCTB & Madrasah Board 5.00 Scale` (`80-100: A+ [5.00]`, `70-79: A [4.00]`, `60-69: A- [3.50]`, `50-59: B [3.00]`, `40-49: C [2.00]`, `33-39: D [1.00]`, `0-32: F [0.00]`).
   - **Grading Scale 2:** `National University (NU) & IAU 4.00 Scale` (`80-100: A+ [4.00]`, `75-79: A [3.75]`, `70-74: A- [3.50]`, `65-69: B+ [3.25]`, `60-64: B [3.00]`, `55-59: B- [2.75]`, `50-54: C+ [2.50]`, `45-49: C [2.25]`, `40-44: D [2.00]`, `0-39: F [0.00]`).
   - **Grading Scale 3:** `NCTB Primary 4-Tier Scale` (`80-100: A`, `60-79: B`, `40-59: C`, `0-39: D`).
   - **Attendance Slab:** Standard 5-mark Honours Attendance Slab (`90-100%: 5`, `85-89%: 4`, `80-84%: 3`, `75-79%: 2`, `<75%: 0`).

#### Acceptance Criteria:
- [ ] Migrations run cleanly on MariaDB and pass strict ANSI SQL checks for PostgreSQL compatibility.
- [ ] All 3 Bangladesh grading scales and attendance slabs are seeded idempotently.

---

### PHASE 2: Syllabus, Paper Merger & Subject Enrollment APIs (NestJS)
**Objective:** Allow institutes to configure subjects, 1st/2nd paper mergers, credit hours, and student-specific 4th subjects.

#### Tasks:
1. Build `SyllabusConfigService` & Controller:
   - CRUD for `academic_subjects` and `class_syllabus_subjects`.
   - Clone utility: `cloneSyllabusFromPreviousSession(sourceSessionId, targetSessionId)`.
   - Validation: Ensure `combined_group_code` subjects within the same class share the same `pass_evaluation_mode` and `default_subject_role`.
2. Build `StudentSubjectEnrollmentService`:
   - Bulk assign compulsory subjects to all students in a Class/Section/Group (Science/Arts/Commerce/Muzabbid).
   - Assign individual `group_elective` and `FOURTH_OPTIONAL` subjects per student (e.g., Higher Math vs. Biology as 4th subject).

#### Acceptance Criteria:
- [ ] Can configure SSC Class 9 Science with Bangla 1st & 2nd merged (`COMBINED_PAPER_COMPONENTS`), Physics standalone (`SEPARATE_COMPONENTS`), and Higher Math as `FOURTH_OPTIONAL`.
- [ ] Can configure Dakhil Class 9 with Quran Mazid, Hadith, Aqaid, and standalone Arabic 1st & 2nd Paper.

---

### PHASE 3: Exam Term, Sub-Exam (CT/Incourse) & Component Distribution Module
**Objective:** Configure exams, CT aggregation rules, and component mark breakdowns (`CQ`, `MCQ`, `Practical`, `CT`, `Attendance`).

#### Tasks:
1. Build `ExamSetupService`:
   - Create `exam_terms` (Sub-Exam CT/Incourse, Terminal Exam, or Cumulative Annual Exam).
   - Configure `exam_subject_components` with bulk copy across subjects of the same type.
   - Validation: Ensure the sum of `converted_max_marks` across all components for a subject equals `class_syllabus_subjects.full_marks` (e.g., `20 CT + 56 Converted CQ + 24 Converted MCQ = 100.00`).

#### Acceptance Criteria:
- [ ] Rejects component setups where $\sum \text{converted\_max\_marks} \neq \text{subject.full\_marks}$.

---

### PHASE 4: High-Speed Marks Entry, Attendance Auto-Pull & CSV/OMR Import
**Objective:** Enable rapid, error-free mark entry by teachers via spreadsheet UI or file upload.

#### Tasks:
1. Build `MarksEntryService`:
   - `getMarksEntrySheet(examTermId, syllabusSubjectId, sectionId)`: Returns pre-populated student rows with component columns and max-mark limits.
   - `bulkUpsertComponentMarks(dto)`: Validates that `0 <= raw_marks_obtained <= component.max_raw_marks`. Computes `converted_marks` immediately using `decimal.js`:
     $$\text{converted\_marks} = \text{raw\_marks\_obtained} \times \left(\frac{\text{conversion\_weight\_pct}}{100}\right)$$
   - `autoPopulateSubExamAndAttendanceMarks(examTermId)`: Automatically pulls and aggregates CT/Incourse scores and calculates Attendance marks from the student attendance module.
   - `importMarksFromCsvOrOmr(file)`: Parses CSV/Excel sheets from OMR scanners and maps Roll/Registration numbers to `student_component_marks`.

#### Acceptance Criteria:
- [ ] Entering a raw mark exceeding `max_raw_marks` throws a descriptive validation error with the student roll and component name.
- [ ] Bulk upserting 100 students × 4 components executes in a single database transaction in `< 300ms`.

---

### PHASE 5: The 8-Stage Result Calculation & Merit Ranking Engine (BullMQ Worker)
**Objective:** Implement the core calculation pipeline that populates `student_subject_results` and `student_term_marksheets`.

#### Tasks:
1. Build `ResultCalculationService` implementing the exact 8 stages:
   - **Stage 1:** Sync auto-components (`AUTO_FROM_SUB_EXAMS` and `AUTO_FROM_ATTENDANCE`).
   - **Stage 2:** Evaluate component-level pass (`is_passed_component`) and calculate subject totals.
   - **Stage 3:** Execute 1st & 2nd Paper Merging (`combined_group_code`) and evaluate `COMBINED_PAPER_COMPONENTS` vs. `SEPARATE_COMPONENTS`.
   - **Stage 4:** Compute `highest_marks_in_class` per subject and merged group.
   - **Stage 5:** Apply 4th Subject Bonus GP (`MAX(0, GP - deduction)`) and fail immunity.
   - **Stage 6:** Compute `gpa_without_fourth`, `final_gpa_or_cgpa` (5.00 or 4.00 Credit-Weighted), and `result_status` (`PASSED`, `FAILED`, `PROMOTED_WITH_F`).
   - **Stage 7:** (If `CUMULATIVE_ANNUAL` exam) Aggregate weighted term marks across linked terminal exams (e.g., `25% Term 1 + 25% Term 2 + 50% Final`).
   - **Stage 8:** Execute deterministic Merit Ranking across Section, Shift, and Class using the tie-breaker comparator:
     1. `failed_subject_count ASC`
     2. `final_gpa_or_cgpa DESC`
     3. `gpa_without_fourth DESC`
     4. `marks_with_fourth DESC`
     5. `marks_without_fourth DESC`
     6. `attendance_percentage DESC`
     7. `previous_roll ASC`
2. Wrap the pipeline in a background job (`@nestjs/bullmq` or async job table) with real-time progress reporting (`0% -> 100%`) and transaction rollback on error.

#### Acceptance Criteria:
- [ ] **SSC/Dakhil Test:** Student with 5 compulsory `A+` (5.00), 1 compulsory `A` (4.00), and 4th subject `A+` (5.00 -> +3.00 bonus) achieves `gpa_without_fourth = 4.83` and `final_gpa_or_cgpa = 5.00`.
- [ ] **Component Fail Test:** Student scoring `85/100` total in Physics (`CQ: 55/50`, `MCQ: 7/25 [Pass is 8]`, `Prac: 23/25`) gets `Grade = F (0.00)` with `fail_reason = 'FAILED_MCQ'`.
- [ ] **Combined Paper Pass Test:** Student scoring `18/70` CQ in Bangla 1st and `30/70` CQ in Bangla 2nd (Sum = `48/140`, Pass = `46`) passes under `COMBINED_PAPER_COMPONENTS`.
- [ ] **Honours 4.00 CGPA Test:** Student taking four 4-credit courses (`GP: 4.00, 3.75, 3.25, 3.00`) and one 2-credit lab (`GP: 4.00`) achieves exact credit-weighted CGPA of `3.56`.

---

### PHASE 6: Reporting, Marksheets, Tabulation Sheet & Analytics API
**Objective:** Serve structured JSON and printable PDF/Excel data for transcripts and broadsheets.

#### Tasks:
1. Build `ResultReportingService`:
   - `getStudentTranscript(examTermId, studentId)`: Returns student profile, component-wise marks, merged paper summaries, class highest marks, GPA with/without 4th subject, merit position, attendance summary, and QR verification payload.
   - `getMasterTabulationBroadsheet(examTermId, classId, sectionId)`: Returns the wide matrix of all students × all subjects/components for the A3/Legal Tabulation Sheet.
   - `getExamSummaryAnalytics(examTermId)`: Returns total appeared, passed, failed, pass %, grade histogram (`A+`, `A`, `A-`, `B`, `C`, `D`, `F`), and subject-wise teacher pass/fail breakdown.

#### Acceptance Criteria:
- [ ] Tabulation sheet query fetches 500 students with all subjects and components in `< 500ms` using indexed snapshot tables (`student_subject_results` and `student_term_marksheets`) with zero on-the-fly recalculation.

---

### PHASE 7: Next.js Frontend Interfaces & Print Layouts
**Objective:** Build intuitive configuration screens, an Excel-speed mark entry grid, and print-ready Bangladesh board transcripts.

#### Tasks:
1. **Syllabus & Exam Rule Configurator (`/academic-results/settings` & `/exams/[examId]/components`):**
   - Preset selector buttons (*"Load NCTB Secondary 5.00"*, *"Load Madrasah Dakhil/Alim"*, *"Load NU Honours 4.00"*, *"Load Primary 4-Tier"*).
   - Visual table to group 1st & 2nd papers and toggle `SEPARATE_COMPONENTS` vs. `COMBINED_PAPER_COMPONENTS`.
2. **Keyboard-First Spreadsheet Marks Entry (`/academic-results/marks-entry`):**
   - Built with `@tanstack/react-table`. Supports `Arrow Up/Down/Left/Right`, `Enter`, and `Tab` navigation across cells.
   - Typing `A` or `a` toggles the `Absent` badge; typing a number `> max_raw_marks` highlights the cell border in red and blocks saving; shows live converted mark preview next to the raw input.
3. **Result Processor Console (`/academic-results/exams/[examId]/process`):**
   - Pre-flight check displaying any missing mark entries per teacher/subject before allowing generation.
   - Progress bar showing live calculation stages (`Aggregating CTs -> Merging Papers -> Computing GPA -> Ranking Merit`).
4. **Print-Ready Marksheet & Tabulation Templates (`/academic-results/outputs`):**
   - CSS `@media print` A4 Portrait layout for **Student Progress Reports** (Institute Header/Logo, Student Info, Component Table with Merged Rowspans for 1st/2nd Paper, Grading Scale Legend on top-right, Guardian/Class Teacher/Principal signature blocks, and QR code).
   - CSS `@media print` A3/Legal Landscape layout for the **Master Tabulation Broadsheet**.

#### Acceptance Criteria:
- [ ] Marksheet table accurately renders `rowSpan={2}` for merged 1st and 2nd paper grades (e.g., Bangla 1st and Bangla 2nd show individual CQ/MCQ marks in their own rows, while Total `200`, Combined Obtained, Letter Grade, and GP span across both rows).
- [ ] Print layouts fit cleanly on A4 (Marksheet) and Legal/A3 Landscape (Tabulation Sheet) without awkward page breaks.