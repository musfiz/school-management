# MASTER AGENT IMPLEMENTATION PLAN & DESIGN SPEC:

## Bangladesh Multi-Institute Student Admission, Family Registry & Enrollment Engine

## 1. System Context & Architectural Mandate

You are implementing the **Student Admission, Parent/Family Registry, Subject Assignment, and Admission Billing/Waiver Module** for an educational ERP in Bangladesh. It must seamlessly support **Kindergartens, Schools, Colleges (HSC), Madrasahs (Alia & Qawmi), and Universities (Honours/Degree/Private)** and connect directly to the **Accounting Engine** and **Academic Result Engine**.

### Tech Stack & Strict Portability Rules

- **Backend:** NestJS (TypeScript, Modular Architecture, `decimal.js`, Class-Validator).
- **Database:** MariaDB 10.6+ / MySQL 8.0+ written with **100% PostgreSQL portability** (use `DECIMAL(15,2)` for money, `DECIMAL(4,2)` for GPA, `VARCHAR` backed by TypeScript Enums, standard ANSI SQL, and interactive transactions).
- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS, `shadcn/ui`, Multi-Step Wizard Form with `react-hook-form` + `zod`, Webcam/Photo cropper, Instant Printable Admission Form & Money Receipt).

---

## 2. Target Directory Structure

### Backend (`apps/api/src/modules/admissions/`)

```text
src/modules/admissions/
├── campaigns-circulars/      # Admission Circulars, Seat Capacity, Eligibility Rules, Form Sale
├── applications/             # Online/Walk-in Applications, Merit Test Score, Waiting List
├── family-registry/          # Parent/Guardian Master, NID/Phone Lookup, Sibling Detector
├── student-onboarding/       # Atomic Admission Orchestrator (Profile + Enrollment + Subjects + Waiver + Invoice)
├── enrollment-promotion/     # Roll Number Generator, Section Transfer, TC Issue, Readmission
└── common/                   # Student ID & Roll sequence generators, BRN/NID validators
```

### Frontend (`apps/web/src/app/(dashboard)/admissions/`)

```text
src/app/(dashboard)/admissions/
├── dashboard/                # Seat capacity vs admitted stats, today's admissions, pending fee list
├── applications/             # Applicant pipeline, admission test marks entry, merit selection
├── direct-admission/         # 5-Step Direct Admission Wizard (Student -> Parent/Sibling -> Academic/Subjects -> Waiver/Hostel -> Fee Invoice & POS)
├── students/                 # Master Student Directory, Profile View, ID Card & Admission Form Print
├── families/                 # Family/Parent Directory & Multi-Sibling linkage viewer
└── settings/                 # ID Format Builder, Quota/Waiver Presets, Required Document Checklist
```

---

## 3. Portable Relational Database Schema (MariaDB & PostgreSQL Ready)

Implement these 7 core tables in your ORM (Prisma or TypeORM). They link directly to `student_waivers_scholarships`, `student_invoices` (Accounting Module), and `student_subject_enrollments` (Result Module).

```sql
-- =========================================================================
-- 1. ADMISSION CIRCULARS & ONLINE/WALK-IN APPLICATIONS (PRE-ADMISSION)
-- =========================================================================

CREATE TABLE admission_campaigns (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    academic_session_id BIGINT NOT NULL,
    class_or_dept_id BIGINT NOT NULL,
    campaign_title VARCHAR(150) NOT NULL,       -- e.g., 'HSC Admission 2026-27', 'Play to Class 9 Admission 2026'
    application_fee DECIMAL(10, 2) DEFAULT 0.00,-- Prospectus / Form Fee (posts to GL 44102)
    total_seats INT NOT NULL,
    min_required_gpa DECIMAL(4, 2) DEFAULT 0.00,-- Used for College/University eligibility check
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE admission_applications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(30) UNIQUE NOT NULL, -- e.g., 'APP-2026-00412'
    campaign_id BIGINT NOT NULL REFERENCES admission_campaigns(id),
    applicant_name_en VARCHAR(120) NOT NULL,
    applicant_name_bn VARCHAR(120),
    gender VARCHAR(15) NOT NULL,
    date_of_birth DATE NOT NULL,
    birth_reg_no VARCHAR(25),                   -- 17-digit Bangladesh BRN
    guardian_phone VARCHAR(20) NOT NULL,
    prev_exam_name VARCHAR(30),                 -- 'SSC', 'DAKHIL', 'HSC', 'JSC', 'PECE'
    prev_board VARCHAR(30),                     -- 'DHAKA', 'MADRASAH', 'COMILLA', etc.
    prev_roll_no VARCHAR(30),
    prev_reg_no VARCHAR(30),
    prev_passing_year INT,
    prev_gpa DECIMAL(4, 2),
    admission_test_marks DECIMAL(6, 2) DEFAULT 0.00,
    merit_rank INT,
    quota_applied VARCHAR(40),                  -- 'GENERAL', 'FREEDOM_FIGHTER', 'SIBLING', 'ORPHAN_LILLAH', 'STAFF_CHILD'
    form_fee_paid BOOLEAN DEFAULT FALSE,
    status VARCHAR(25) DEFAULT 'APPLIED',       -- 'APPLIED', 'SHORTLISTED', 'WAITING', 'ADMITTED', 'REJECTED'
    admitted_student_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 2. FAMILY / PARENT REGISTRY (MULTI-SIBLING LINKAGE)
-- =========================================================================

CREATE TABLE family_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    family_code VARCHAR(30) UNIQUE NOT NULL,    -- e.g., 'FAM-2026-00891'
    primary_guardian_phone VARCHAR(20) UNIQUE NOT NULL, -- Login ID for Parent Portal & SMS
    father_name_en VARCHAR(120) NOT NULL,
    father_name_bn VARCHAR(120),
    father_nid VARCHAR(25),
    father_occupation VARCHAR(80),
    father_monthly_income DECIMAL(12, 2) DEFAULT 0.00,
    is_father_deceased BOOLEAN DEFAULT FALSE,   -- Critical trigger for Madrasah Orphan/Lillah verification
    mother_name_en VARCHAR(120) NOT NULL,
    mother_name_bn VARCHAR(120),
    mother_nid VARCHAR(25),
    mother_phone VARCHAR(20),
    mother_occupation VARCHAR(80),
    local_guardian_name VARCHAR(120),
    local_guardian_relation VARCHAR(50),
    local_guardian_phone VARCHAR(20),
    local_guardian_nid VARCHAR(25),
    present_address TEXT NOT NULL,
    permanent_address TEXT,
    upazila_thana VARCHAR(80),
    district VARCHAR(80),
    is_zakat_eligible_family BOOLEAN DEFAULT FALSE, -- Verified poor/orphan family for Fund 02 (Lillah)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 3. MASTER STUDENT IDENTITY & PREVIOUS ACADEMIC HISTORY
-- =========================================================================

CREATE TABLE students (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_unique_id VARCHAR(30) UNIQUE NOT NULL, -- Permanent ID (e.g., 'STD-26-00105')
    govt_uid_crvs VARCHAR(30) UNIQUE,           -- Bangladesh Govt CRVS / UID number
    family_profile_id BIGINT NOT NULL REFERENCES family_profiles(id),
    full_name_en VARCHAR(120) NOT NULL,
    full_name_bn VARCHAR(120),
    gender VARCHAR(15) NOT NULL,                -- 'MALE', 'FEMALE', 'OTHER'
    date_of_birth DATE NOT NULL,
    birth_reg_no VARCHAR(25) UNIQUE,            -- 17-digit Birth Certificate No
    national_id_no VARCHAR(25),                 -- For University / College students
    religion VARCHAR(25) NOT NULL,              -- 'ISLAM', 'HINDUISM', 'CHRISTIANITY', 'BUDDHISM'
    blood_group VARCHAR(10),
    photo_url VARCHAR(255),
    medical_allergy_notes TEXT,                 -- Crucial for Kindergarten/Hostel
    stipend_mfs_type VARCHAR(20),               -- 'BKASH', 'NAGAD', 'ROCKET', 'BANK_EFT' (For Govt Upobritti)
    stipend_account_no VARCHAR(30),
    admission_date DATE NOT NULL,
    current_status VARCHAR(25) DEFAULT 'ACTIVE',-- 'ACTIVE', 'TC_ISSUED', 'GRADUATED', 'DROPPED', 'SUSPENDED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_previous_educations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_title VARCHAR(40) NOT NULL,            -- 'PSC', 'JSC', 'SSC', 'DAKHIL', 'HSC', 'ALIM', 'PREV_SCHOOL_TC'
    institute_name VARCHAR(150) NOT NULL,
    education_board VARCHAR(40),                -- 'DHAKA', 'MADRASAH', 'TECHNICAL', etc.
    Academic_group VARCHAR(40),                 -- 'SCIENCE', 'HUMANITIES', 'BUSINESS', 'MUZABBID'
    roll_no VARCHAR(30),
    reg_no VARCHAR(30),
    passing_year INT,
    gpa_obtained DECIMAL(4, 2),
    gpa_scale DECIMAL(4, 2) DEFAULT 5.00,
    tc_number VARCHAR(50),
    tc_date DATE
);

-- =========================================================================
-- 4. SESSION-WISE ACADEMIC ENROLLMENT & AUXILIARY SERVICES
-- =========================================================================

CREATE TABLE student_enrollments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id),
    academic_session_id BIGINT NOT NULL,        -- e.g., '2026', '2026-2027'
    institution_type VARCHAR(25) NOT NULL,      -- 'KINDERGARTEN', 'SCHOOL', 'COLLEGE', 'MADRASAH', 'UNIVERSITY'
    class_or_dept_id BIGINT NOT NULL,           -- Class (Play..12), Jamaat, or Dept/Semester
    shift_id BIGINT,                            -- Morning / Day
    section_or_batch_id BIGINT,                 -- Section A, Batch 14
    academic_group VARCHAR(40) DEFAULT 'GENERAL',-- 'GENERAL', 'SCIENCE', 'ARTS', 'COMMERCE', 'MUZABBID', 'HIFZ'
    class_roll_no INT NOT NULL,                 -- Sequential Roll inside Class+Section+Group
    board_registration_no VARCHAR(40),
    enrollment_type VARCHAR(25) NOT NULL,       -- 'NEW_ADMISSION', 'PROMOTED', 'REPEAT', 'READMISSION'
    residence_type VARCHAR(25) DEFAULT 'DAY_SCHOLAR', -- 'DAY_SCHOLAR', 'HOSTEL_REGULAR', 'MADRASAH_LILLAH_BOARDER'
    hostel_seat_id BIGINT,
    transport_route_id BIGINT,
    quota_tag VARCHAR(40) DEFAULT 'NONE',       -- 'MERIT', 'SIBLING', 'FREEDOM_FIGHTER', 'ORPHAN_LILLAH', 'STAFF_CHILD'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_session_class_section_roll (academic_session_id, class_or_dept_id, section_or_batch_id, class_roll_no),
    UNIQUE KEY uq_student_active_session (student_id, academic_session_id)
);

-- =========================================================================
-- 5. STUDENT DOCUMENTS & VERIFICATION CHECKLIST
-- =========================================================================

CREATE TABLE student_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    document_type VARCHAR(40) NOT NULL,         -- 'BIRTH_CERT', 'FATHER_NID', 'MOTHER_NID', 'TC_COPY', 'SSC_MARKSHEET', 'ORPHAN_CERT'
    file_url VARCHAR(255) NOT NULL,
    is_original_submitted BOOLEAN DEFAULT FALSE,-- Colleges/Universities often hold original SSC/HSC transcripts
    verified_by BIGINT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Core Business Logic & Cross-Module Integration Rules

The coding agent MUST implement these 5 business workflows inside `StudentOnboardingService`:

### Workflow 1: Smart Family Lookup & Automatic Sibling Waiver Detection

When the admission officer types `primary_guardian_phone` or `father_nid` in the Admission Wizard:

1. Query `family_profiles` along with any `students` and active `student_enrollments` linked to that family.
2. If a match is found:
   - Auto-fill Father, Mother, Local Guardian, and Address fields in the UI.
   - Return `active_siblings: [{ name, class, roll, student_unique_id }]`.
   - Automatically suggest the configured **Sibling Waiver Preset** (e.g., `25% Waiver on Admission Fee` and `20% Waiver on Monthly Tuition Fee`).

### Workflow 2: Dynamic GPA-Based & Quota Waiver Calculator (College / University / Madrasah)

1. **HSC / University Merit Waiver:** When `prev_gpa` (e.g., SSC GPA = `5.00`) is entered during Class 11 or University admission, check the institute's `waiver_preset_rules` table:
   - E.g., `SSC GPA == 5.00 (Golden)` $\rightarrow$ Auto-select `100% Admission Fee Waiver + 50% Tuition Fee Waiver`.
2. **Madrasah Orphan / Lillah (Zakat) Boarding Rule:**
   - When `residence_type === 'MADRASAH_LILLAH_BOARDER'` or `quota_tag === 'ORPHAN_LILLAH'`, require `family_profiles.is_zakat_eligible_family = true`.
   - Automatically create a `100% LILLAH_ZAKAT_ORPHAN` waiver in `student_waivers_scholarships` linked to **`Fund 02 (Restricted Lillah/Zakat Fund)`** and Contra-GL `41904` so that the student's monthly mess/boarding and tuition fees are funded strictly from Zakat/Lillah without touching the General Fund.

### Workflow 3: Automatic Subject & 4th-Subject Enrollment (Handshake with Result Engine)

During Step 3 of the Admission Wizard, based on `class_or_dept_id` and `academic_group`:

1. Fetch all `class_syllabus_subjects` for that Class and Session.
2. Automatically check and lock all `COMPULSORY` and matching `GROUP_ELECTIVE` subjects (including both 1st and 2nd papers).
3. If the class is **Class 9–10 (SSC/Dakhil)** or **Class 11–12 (HSC/Alim)**, require the user to pick **1 Optional Subject (`FOURTH_OPTIONAL`)** (e.g., Higher Math vs. Biology vs. Agriculture) and insert all selected rows into `student_subject_enrollments`.
4. If the institution is **University / Honours / Degree**, enroll the student in the 1st-semester/1st-year credit courses.

### Workflow 4: Atomic Admission Invoice & Accounting GL Posting (Handshake with Accounting Engine)

Inside the same database transaction as `confirmStudentAdmission(dto)`:

1. Fetch all `ONE_TIME` / `ADMISSION` and `ANNUAL` / `FIRST_MONTH` fee heads configured for `class_or_dept_id` (e.g., Admission Fee, Session Fee, ICT Fee, Library Caution Deposit, 1st Month Tuition).
2. Apply any Admission-time Waiver (`admission_waiver_pct` or fixed discount) per fee head:
   $$\text{net\_amount} = \text{gross\_amount} - \text{waiver\_amount}$$
3. Insert `student_invoices` and `student_invoice_lines`.
4. Call `JournalPostingService.createAndApproveSystemJournal()` to post the accrual double-entry voucher:
   - **Dr** `11401` Accounts Receivable – Student (`subledger_id = student.id`) = `net_payable_amount`
   - **Dr** `41901..41904` Scholarship / Admission Waiver Contra-Revenue = `total_waiver_amount`
   - **Cr** `41102` Admission Fee Revenue = `gross_admission_fee`
   - **Cr** `41103` Session / Development Fee Revenue = `gross_session_fee`
   - **Cr** `21401` Library/Lab Caution Money Deposit (Liability) = `gross_caution_deposit`
5. **Instant POS Collection Option:** If the user clicks **"Admit & Receive Cash/MFS Now"**, immediately execute `FeeCollectionService.collectPayment()` in the same transaction and return both the `student_unique_id` and the printable `money_receipt_no`.

---

## 5. Step-by-Step Execution Phases for the Working Agent

Execute these **5 Phases** sequentially. Verify all acceptance tests at the end of each phase before moving to the next.

---

### PHASE 1: Database Migrations & Admission Config Seeders

**Objective:** Create the 7 admission/enrollment tables and connect foreign keys to Accounting and Result tables.

#### Tasks:

1. Generate ORM models and migrations for `admission_campaigns`, `admission_applications`, `family_profiles`, `students`, `student_previous_educations`, `student_enrollments`, and `student_documents`.
2. Create `StudentIdGeneratorService` and `RollNumberGeneratorService` using row-level locking (`FOR UPDATE`) to generate:
   - Custom formatted `student_unique_id` (e.g., `[YEAR]-[CLASS_CODE]-[SEQ_4]`).
   - Next available sequential `class_roll_no` within `(academic_session_id, class_or_dept_id, section_or_batch_id)`.

#### Acceptance Criteria:

- [ ] Migrations run cleanly on MariaDB and pass strict PostgreSQL compatibility checks.
- [ ] Concurrent admission requests never generate duplicate `student_unique_id` or `class_roll_no`.

---

### PHASE 2: Family Registry, Sibling Detector & Pre-Admission Application API

**Objective:** Build parent lookup, online/walk-in application processing, and admission test merit lists.

#### Tasks:

1. Build `FamilyRegistryService`:
   - `lookupByPhoneOrNid(query)`: Returns existing `family_profiles` with linked sibling list and recommended sibling waiver.
2. Build `AdmissionApplicationService`:
   - Public/Walk-in endpoint to submit `admission_applications` and collect Prospectus/Form Fee (posting to GL `44102 Sale of Admission Forms`).
   - Bulk entry of `admission_test_marks` and automatic `merit_rank` calculation.
   - `convertApplicationToAdmissionDraft(applicationId)`: Pre-fills the Direct Admission payload from an approved applicant.

#### Acceptance Criteria:

- [ ] Searching an existing parent's mobile number returns their profile and active children in `< 100ms`.

---

### PHASE 3: The Atomic Student Onboarding & Waiver/Invoice Orchestrator (NestJS)

**Objective:** Implement the single-transaction admission engine connecting Student Profile, Enrollment, Subjects, Waivers, and Accounting GL.

#### Tasks:

1. Build `StudentOnboardingService.admitStudent(dto)`:
   - Wrap all 6 steps (`family_profiles` upsert $\rightarrow$ `students` insert $\rightarrow$ `student_previous_educations` insert $\rightarrow$ `student_enrollments` insert $\rightarrow$ `student_subject_enrollments` bulk insert $\rightarrow$ `student_waivers_scholarships` insert $\rightarrow$ `student_invoices` + GL Journal creation) inside one interactive database transaction.
   - Enforce Madrasah Lillah Fund rule: Verify `is_zakat_eligible_family = true` before assigning `Fund 02` waivers.
   - Enforce College/Secondary 4th Subject rule: Validate that Class 9–12 admissions include exactly one `FOURTH_OPTIONAL` subject group.

#### Acceptance Criteria:

- [ ] If invoice generation or GL posting fails due to a misconfigured fee head, the entire student admission rolls back cleanly (zero orphan student rows).
- [ ] Admitting a student with a 2,000 BDT Admission Waiver on a 10,000 BDT Admission Fee creates a student ledger balance of 8,000 BDT and a balanced 3-line GL Journal Entry.

---

### PHASE 4: Next.js 5-Step Direct Admission Wizard & Sibling/Waiver UI

**Objective:** Build a fast, adaptive admission interface that morphs fields based on Kindergarten, School, College, Madrasah, or University mode.

#### Tasks:

1. Build `/admissions/direct-admission` with a 5-step `<Stepper />` form (`react-hook-form` + `zod`):
   - **Step 1: Family & Sibling Check:** Enter Guardian Phone / Father NID first. If a match exists, show a green **"Existing Family Found (1 Sibling in Class 7)"** banner, auto-fill parent fields, and toggle the Sibling Waiver badge.
   - **Step 2: Student Identity & Previous Education:** Name (English & Bangla), DOB, 17-digit BRN, Blood Group, Photo upload/webcam capture, and conditional Previous Exam table (SSC/Dakhil/HSC Roll, Reg, Board, GPA, TC No).
   - **Step 3: Academic Placement & Subject Selection:** Select Session, Shift, Class/Dept, Group, Section, auto-assigned Class Roll preview, and interactive **Compulsory + 4th Optional Subject Picker** (or Semester Course checklist for University).
   - **Step 4: Waivers, Stipends & Residential/Transport:** Select Quota/Waiver (`Merit`, `Sibling`, `Freedom Fighter`, `Orphan/Lillah Zakat`, `Custom %`), Upobritti MFS account, Hostel/Mess boarding, or School Bus route.
   - **Step 5: Admission Fee Breakdown & Instant Collection:** Live table showing itemized Admission Fees, applied Waiver discounts, Net Payable, and two submit buttons:
     - **"Confirm Admission & Generate Invoice (Pay Later)"**
     - **"Confirm Admission & Collect Payment Now (Cash / bKash / Bank)"**
2. Build Instant Print Views:
   - **Printable Admission Form (A4)** with student photo, barcode, subject list, and parent/principal signature blocks.
   - **Printable Admission Money Receipt** and **Student ID Card Preview**.

#### Acceptance Criteria:

- [ ] Selecting "College (Class 11–12)" dynamically reveals SSC Board Roll/GPA inputs and 4th Subject selector; selecting "Kindergarten" hides SSC fields and shows Pick-up Guardian & Allergy fields; selecting "Madrasah" shows Lillah/Zakat Orphan verification & Muqeem/Boarding options.

---

### PHASE 5: Student Directory, Promotion, Section Transfer & TC Workflow

**Objective:** Manage post-admission lifecycle changes.

#### Tasks:

1. Build `/admissions/students` master directory with filters by Session, Class, Section, Group, Quota, Residential Status, and Fee Due status.
2. Build **Transfer Certificate (TC) & Clearance Check**: Before issuing a TC (`status = 'TC_ISSUED'`), query the Accounting Module to ensure `Student AR Balance == 0.00` and Library/Lab Caution Deposits are settled.

#### Acceptance Criteria:

- [ ] Attempting to issue a Transfer Certificate (TC) to a student with unpaid tuition or library dues blocks the action until dues are cleared or waived.
