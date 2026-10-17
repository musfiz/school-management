-- CreateTable
CREATE TABLE `academic_subjects` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `subject_code` VARCHAR(30) NOT NULL,
    `subject_name` VARCHAR(150) NOT NULL,
    `board_stream` VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    `paper_number` INTEGER NULL,

    INDEX `IDX_SUBJECTS_CODE`(`subject_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `accounting_audit_logs` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `event_type` VARCHAR(50) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` CHAR(36) NOT NULL,
    `entity_reference` VARCHAR(100) NULL,
    `actor_id` CHAR(36) NULL,
    `action` VARCHAR(50) NOT NULL,
    `details` TEXT NULL,
    `ip_address` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `IDX_AUDIT_LOG_ACTOR`(`actor_id`),
    INDEX `IDX_AUDIT_LOG_CREATED_AT`(`created_at`),
    INDEX `IDX_AUDIT_LOG_ENTITY`(`entity_type`, `entity_id`),
    INDEX `IDX_AUDIT_LOG_EVENT_TYPE`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `adjunct_honorarium_bills` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `bill_no` VARCHAR(30) NOT NULL,
    `adjunct_name` VARCHAR(150) NOT NULL,
    `adjunct_id` CHAR(36) NULL,
    `work_month` VARCHAR(7) NOT NULL,
    `classes_count` INTEGER NOT NULL DEFAULT 0,
    `scripts_count` INTEGER NOT NULL DEFAULT 0,
    `viva_count` INTEGER NOT NULL DEFAULT 0,
    `rate_per_class` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `rate_per_script` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `rate_per_viva` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `gross_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `tds_rate` DECIMAL(5, 2) NOT NULL,
    `tds_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_payable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `fund_id` CHAR(36) NOT NULL,
    `cost_center_id` CHAR(36) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `gl_journal_id` CHAR(36) NULL,
    `narration` VARCHAR(255) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_7e2c431b23b598fa0d960c4f619`(`bill_no`),
    INDEX `FK_4f289bec631bfba5cd9c4049b2e`(`gl_journal_id`),
    INDEX `FK_7f39a395e294512630a28f76aef`(`created_by_user_id`),
    INDEX `FK_ce9decd83d40698cd87796eb5ae`(`cost_center_id`),
    INDEX `FK_f4a75afd9e3f9a1b79e3da340e3`(`fund_id`),
    INDEX `IDX_HONORARIUM_MONTH`(`work_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `admission_applications` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `application_no` VARCHAR(30) NOT NULL,
    `campaign_id` CHAR(36) NOT NULL,
    `applicant_name_en` VARCHAR(120) NOT NULL,
    `applicant_name_bn` VARCHAR(120) NULL,
    `gender` VARCHAR(15) NOT NULL,
    `date_of_birth` DATE NOT NULL,
    `birth_reg_no` VARCHAR(25) NULL,
    `guardian_phone` VARCHAR(20) NOT NULL,
    `prev_exam_name` VARCHAR(30) NULL,
    `prev_board` VARCHAR(30) NULL,
    `prev_roll_no` VARCHAR(30) NULL,
    `prev_reg_no` VARCHAR(30) NULL,
    `prev_passing_year` INTEGER NULL,
    `prev_gpa` DECIMAL(4, 2) NULL,
    `admission_test_marks` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `merit_rank` INTEGER NULL,
    `quota_applied` VARCHAR(40) NULL,
    `form_fee_paid` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(25) NOT NULL DEFAULT 'APPLIED',
    `admitted_student_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_ef98819df5645c1238978424af4`(`application_no`),
    INDEX `FK_ebba2cd78268c80e1d1b4f6d959`(`admitted_student_id`),
    INDEX `IDX_APPLICATIONS_CAMPAIGN`(`campaign_id`),
    INDEX `IDX_APPLICATIONS_MERIT`(`campaign_id`, `merit_rank`),
    INDEX `IDX_APPLICATIONS_PHONE`(`guardian_phone`),
    INDEX `IDX_APPLICATIONS_STATUS`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `admission_campaigns` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `academic_session_id` CHAR(36) NOT NULL,
    `class_or_dept_id` CHAR(36) NOT NULL,
    `campaign_title` VARCHAR(150) NOT NULL,
    `application_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `total_seats` INTEGER NOT NULL,
    `min_required_gpa` DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `IDX_CAMPAIGNS_ACTIVE`(`is_active`),
    INDEX `IDX_CAMPAIGNS_SESSION_CLASS`(`academic_session_id`, `class_or_dept_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `admission_sequences` (
    `scope_key` VARCHAR(160) NOT NULL,
    `last_number` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`scope_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `chart_of_accounts` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `gl_code` VARCHAR(20) NOT NULL,
    `account_name` VARCHAR(150) NOT NULL,
    `account_name_bn` VARCHAR(150) NULL,
    `account_type` VARCHAR(20) NOT NULL,
    `normal_balance` CHAR(2) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `is_control_account` BOOLEAN NOT NULL DEFAULT false,
    `is_cash_or_bank` BOOLEAN NOT NULL DEFAULT false,
    `default_fund_id` CHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_6bb8e35e8b83eeaa49218ac45cc`(`gl_code`),
    INDEX `FK_coa_default_fund`(`default_fund_id`),
    INDEX `FK_coa_parent`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `class_syllabus_subjects` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `academic_session_id` CHAR(36) NOT NULL,
    `class_or_dept_id` CHAR(36) NOT NULL,
    `subject_id` CHAR(36) NOT NULL,
    `combined_group_code` VARCHAR(40) NULL,
    `combined_group_name` VARCHAR(100) NULL,
    `default_subject_role` VARCHAR(30) NOT NULL,
    `elective_group` VARCHAR(40) NULL,
    `credit_hours` DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    `full_marks` DECIMAL(6, 2) NOT NULL DEFAULT 100.00,
    `pass_evaluation_mode` VARCHAR(40) NOT NULL DEFAULT 'SEPARATE_COMPONENTS',
    `display_order` INTEGER NOT NULL DEFAULT 1,

    INDEX `FK_6db9c01b5b77757cb51ec8963dd`(`subject_id`),
    INDEX `IDX_SYLLABUS_SESSION_CLASS`(`academic_session_id`, `class_or_dept_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `cost_centers` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `center_code` VARCHAR(15) NOT NULL,
    `center_name` VARCHAR(100) NOT NULL,
    `institution_type` VARCHAR(20) NOT NULL DEFAULT 'SCHOOL',
    `parent_id` CHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_59074ee7f832613289d2c4ef60e`(`center_code`),
    INDEX `FK_cost_centers_parent`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `ex_principals` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(150) NOT NULL,
    `name_bn` VARCHAR(150) NULL,
    `tenure` VARCHAR(150) NULL,
    `image_url` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `family_profiles` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `family_code` VARCHAR(30) NOT NULL,
    `primary_guardian_phone` VARCHAR(20) NOT NULL,
    `father_name_en` VARCHAR(120) NOT NULL,
    `father_name_bn` VARCHAR(120) NULL,
    `father_nid` VARCHAR(25) NULL,
    `father_occupation` VARCHAR(80) NULL,
    `father_monthly_income` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `is_father_deceased` BOOLEAN NOT NULL DEFAULT false,
    `mother_name_en` VARCHAR(120) NOT NULL,
    `mother_name_bn` VARCHAR(120) NULL,
    `mother_nid` VARCHAR(25) NULL,
    `mother_phone` VARCHAR(20) NULL,
    `mother_occupation` VARCHAR(80) NULL,
    `local_guardian_name` VARCHAR(120) NULL,
    `local_guardian_relation` VARCHAR(50) NULL,
    `local_guardian_phone` VARCHAR(20) NULL,
    `local_guardian_nid` VARCHAR(25) NULL,
    `present_address` TEXT NOT NULL,
    `permanent_address` TEXT NULL,
    `upazila_thana` VARCHAR(80) NULL,
    `district` VARCHAR(80) NULL,
    `is_zakat_eligible_family` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_0b4f7780952dd433283cdebb017`(`family_code`),
    UNIQUE INDEX `UQ_a4eea2986841bf2e59fc8dce641`(`primary_guardian_phone`),
    INDEX `IDX_FAMILY_FATHER_NID`(`father_nid`),
    INDEX `IDX_FAMILY_ZAKAT`(`is_zakat_eligible_family`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `fee_heads` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `head_code` VARCHAR(30) NOT NULL,
    `head_name` VARCHAR(150) NOT NULL,
    `billing_type` VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    `default_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `per_credit_rate` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `revenue_gl_id` CHAR(36) NOT NULL,
    `fund_id` CHAR(36) NULL,
    `cost_center_id` CHAR(36) NULL,
    `is_caution_deposit` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_99370b6d9edecd76e7a49a2249a`(`head_code`),
    INDEX `FK_45728218dd0533dafc4098d578f`(`cost_center_id`),
    INDEX `FK_75669e4129d2d9b6c0765641287`(`fund_id`),
    INDEX `FK_a174486d2c8d482b9116f633548`(`revenue_gl_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `fiscal_periods` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `period_name` VARCHAR(50) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `is_closed` BOOLEAN NOT NULL DEFAULT false,
    `closed_by_user_id` CHAR(36) NULL,
    `closed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `funds` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `fund_code` VARCHAR(10) NOT NULL,
    `fund_name` VARCHAR(100) NOT NULL,
    `is_restricted` BOOLEAN NOT NULL DEFAULT false,
    `shariah_compliant` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_72ed7e29a67443fc48b41f8ec43`(`fund_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `governing_body_members` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(150) NOT NULL,
    `name_bn` VARCHAR(150) NULL,
    `designation` VARCHAR(150) NOT NULL,
    `designation_bn` VARCHAR(150) NULL,
    `image_url` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `hero_sections` (
    `id` CHAR(36) NOT NULL,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,
    `admission_year` VARCHAR(50) NULL,
    `tagline_1` VARCHAR(255) NULL,
    `tagline_1_bn` VARCHAR(255) NULL,
    `tagline_2` VARCHAR(255) NULL,
    `tagline_2_bn` VARCHAR(255) NULL,
    `tagline_3` VARCHAR(255) NULL,
    `tagline_3_bn` VARCHAR(255) NULL,
    `short_description` TEXT NULL,
    `short_description_bn` TEXT NULL,
    `show_apply_button` BOOLEAN NOT NULL DEFAULT true,
    `institute_open_info` VARCHAR(255) NULL,
    `institute_open_info_bn` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `voucher_no` VARCHAR(30) NOT NULL,
    `voucher_type` VARCHAR(20) NOT NULL,
    `transaction_date` DATE NOT NULL,
    `fiscal_period_id` CHAR(36) NOT NULL,
    `source_module` VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    `source_reference_id` CHAR(36) NULL,
    `narration` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `reversed_entry_id` CHAR(36) NULL,
    `created_by_user_id` CHAR(36) NOT NULL,
    `verified_by_user_id` CHAR(36) NULL,
    `approved_by_user_id` CHAR(36) NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_2f3830bf7018a0b27eddd7ad8c0`(`voucher_no`),
    INDEX `FK_0cd1b7a9f4a2dbb2006af7527bd`(`reversed_entry_id`),
    INDEX `FK_1845d906faef6586c6d1ac639a9`(`approved_by_user_id`),
    INDEX `FK_77fe13fb6db6b1fea4ff4d70cd2`(`created_by_user_id`),
    INDEX `FK_dfb001500889ba5445dcebedf7e`(`fiscal_period_id`),
    INDEX `FK_e9a1725d8c4972d7d672a7d5ecd`(`verified_by_user_id`),
    INDEX `IDX_JOURNAL_STATUS`(`status`),
    INDEX `IDX_JOURNAL_TXN_DATE`(`transaction_date`),
    INDEX `IDX_JOURNAL_VOUCHER_NO`(`voucher_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `journal_lines` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `journal_entry_id` CHAR(36) NOT NULL,
    `gl_account_id` CHAR(36) NOT NULL,
    `fund_id` CHAR(36) NOT NULL,
    `cost_center_id` CHAR(36) NULL,
    `subledger_type` VARCHAR(30) NULL,
    `subledger_id` CHAR(36) NULL,
    `debit_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `credit_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `line_memo` VARCHAR(255) NULL,

    INDEX `FK_7002186b79482768d2a8048aca7`(`cost_center_id`),
    INDEX `IDX_JLINES_ENTRY`(`journal_entry_id`),
    INDEX `IDX_JLINES_FUND`(`fund_id`),
    INDEX `IDX_JLINES_GL`(`gl_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `menu_items` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `menu_location` VARCHAR(30) NOT NULL DEFAULT 'header',
    `parent_id` CHAR(36) NULL,
    `label_en` VARCHAR(150) NOT NULL,
    `label_bn` VARCHAR(150) NULL,
    `href` VARCHAR(255) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `FK_MENU_ITEMS_PARENT`(`parent_id`),
    INDEX `IDX_MENU_ITEMS_LOCATION`(`menu_location`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `migrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` BIGINT NOT NULL,
    `name` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `modules` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_8cd1abde4b70e59644c98668c06`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `notices` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `title` VARCHAR(255) NOT NULL,
    `title_bn` VARCHAR(255) NULL,
    `slug` VARCHAR(255) NULL,
    `category` VARCHAR(100) NOT NULL DEFAULT 'General',
    `short_description` TEXT NULL,
    `short_description_bn` TEXT NULL,
    `description` LONGTEXT NULL,
    `description_bn` LONGTEXT NULL,
    `image_url` VARCHAR(500) NULL,
    `pdf_url` VARCHAR(500) NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `publish_date` DATE NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `IDX_notices_category`(`category`),
    INDEX `IDX_notices_is_active`(`is_active`),
    INDEX `IDX_notices_is_pinned`(`is_pinned`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `pages` (
    `slug` VARCHAR(60) NOT NULL,
    `title_en` VARCHAR(200) NOT NULL,
    `title_bn` VARCHAR(200) NULL,
    `content_en` TEXT NULL,
    `content_bn` TEXT NULL,
    `image_url` VARCHAR(255) NULL,
    `show_in_homepage` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `payment_collections` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `money_receipt_no` VARCHAR(30) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `payment_channel` VARCHAR(20) NOT NULL,
    `gateway_trx_id` VARCHAR(80) NULL,
    `collected_gross_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `gateway_tdr_fee` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_bank_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `cash_gl_id` CHAR(36) NOT NULL,
    `fund_id` CHAR(36) NULL,
    `reconciliation_status` VARCHAR(20) NOT NULL DEFAULT 'COLLECTED',
    `gl_journal_id` CHAR(36) NULL,
    `settlement_journal_id` CHAR(36) NULL,
    `bank_reference` VARCHAR(80) NULL,
    `allocation` TEXT NULL,
    `collected_by_user_id` CHAR(36) NULL,
    `remark` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_8efe2b0b69068cd6049767557c2`(`money_receipt_no`),
    UNIQUE INDEX `uq_collection_gateway_trx`(`gateway_trx_id`),
    INDEX `FK_553921c63cd12349c268f20d478`(`fund_id`),
    INDEX `FK_a2ea2f79498def55cbe883c97a0`(`cash_gl_id`),
    INDEX `FK_b149022fe7461319e295a983900`(`gl_journal_id`),
    INDEX `IDX_COLLECTION_INVOICE`(`invoice_id`),
    INDEX `IDX_COLLECTION_STATUS`(`reconciliation_status`),
    INDEX `IDX_COLLECTION_STUDENT`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `payroll_runs` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `run_no` VARCHAR(30) NOT NULL,
    `payroll_month` VARCHAR(7) NOT NULL,
    `pay_date` DATE NOT NULL,
    `fund_id` CHAR(36) NOT NULL,
    `cost_center_id` CHAR(36) NULL,
    `mpo_govt_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `institutional_gross_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `pf_employee_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `pf_employer_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `ait_tds_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `loan_deduction_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_payable_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `gl_journal_id` CHAR(36) NULL,
    `payment_journal_id` CHAR(36) NULL,
    `narration` VARCHAR(255) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_2cef0e9a108106112b863124f6f`(`run_no`),
    INDEX `FK_2784638bcb4961f09de25ceb871`(`cost_center_id`),
    INDEX `FK_6c1c3e51a85243dc4e7b981e2b9`(`created_by_user_id`),
    INDEX `FK_c79243d7310cc718d3d7207b64e`(`payment_journal_id`),
    INDEX `FK_d55de221adb3b66278c1f66681a`(`fund_id`),
    INDEX `FK_e7fda897ba99ea795bf9a22b4e7`(`gl_journal_id`),
    INDEX `IDX_PAYROLL_MONTH`(`payroll_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `payslip_lines` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `run_id` CHAR(36) NOT NULL,
    `employee_id` CHAR(36) NULL,
    `employee_name` VARCHAR(150) NOT NULL,
    `designation` VARCHAR(120) NULL,
    `mpo_govt_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `institutional_gross_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `pf_employee_deduction` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `pf_employer_contribution` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `ait_tds_deduction` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `loan_deduction` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_institutional_payable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `IDX_PAYSLIP_RUN`(`run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `module_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_48ce552495d14eae9b187bb6716`(`name`),
    INDEX `FK_738f46bb9ac6ea356f1915835d0`(`module_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `required_document_rules` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `class_or_dept_id` VARCHAR(36) NOT NULL,
    `document_type` VARCHAR(40) NOT NULL,
    `is_original_required` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `IDX_566ec38bbaf38332e6bd672b9e`(`class_or_dept_id`, `document_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `id` CHAR(36) NOT NULL,
    `site_name` VARCHAR(150) NOT NULL DEFAULT 'My School',
    `tagline` VARCHAR(200) NULL,
    `description` TEXT NULL,
    `logo_url` VARCHAR(255) NULL,
    `header_display` VARCHAR(10) NOT NULL DEFAULT 'both',
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(150) NULL,
    `address` VARCHAR(255) NULL,
    `established` INTEGER NULL,
    `eiin` VARCHAR(30) NULL,
    `facebook_url` VARCHAR(255) NULL,
    `twitter_url` VARCHAR(255) NULL,
    `linkedin_url` VARCHAR(255) NULL,
    `youtube_url` VARCHAR(255) NULL,
    `copyright_text` VARCHAR(255) NULL,
    `site_name_bn` VARCHAR(150) NULL,
    `tagline_bn` VARCHAR(200) NULL,
    `description_bn` TEXT NULL,
    `address_bn` VARCHAR(255) NULL,
    `copyright_text_bn` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `sliders` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `image_url` VARCHAR(255) NOT NULL,
    `title_en` VARCHAR(200) NULL,
    `title_bn` VARCHAR(200) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `staff_members` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(150) NOT NULL,
    `name_bn` VARCHAR(150) NULL,
    `designation` VARCHAR(150) NOT NULL,
    `designation_bn` VARCHAR(150) NULL,
    `image_url` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_caution_deposits` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `student_id` CHAR(36) NOT NULL,
    `gl_account_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(20) NOT NULL DEFAULT 'HELD',
    `receipt_journal_id` CHAR(36) NULL,
    `settlement_journal_id` CHAR(36) NULL,
    `remark` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `FK_fc4ae3d9ab90adc7384becbe386`(`gl_account_id`),
    INDEX `IDX_CAUTION_STUDENT`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_documents` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `student_id` CHAR(36) NOT NULL,
    `document_type` VARCHAR(40) NOT NULL,
    `file_url` VARCHAR(255) NOT NULL,
    `is_original_submitted` BOOLEAN NOT NULL DEFAULT false,
    `verified_by` CHAR(36) NULL,
    `uploaded_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `FK_9a1617311db9e7e586ab9bc05a9`(`verified_by`),
    INDEX `IDX_DOCS_STUDENT`(`student_id`),
    INDEX `IDX_DOCS_TYPE`(`document_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_enrollments` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `student_id` CHAR(36) NOT NULL,
    `academic_session_id` CHAR(36) NOT NULL,
    `institution_type` VARCHAR(25) NOT NULL,
    `class_or_dept_id` CHAR(36) NOT NULL,
    `shift_id` CHAR(36) NULL,
    `section_or_batch_id` CHAR(36) NULL,
    `academic_group` VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
    `class_roll_no` INTEGER NOT NULL,
    `board_registration_no` VARCHAR(40) NULL,
    `enrollment_type` VARCHAR(25) NOT NULL,
    `residence_type` VARCHAR(25) NOT NULL DEFAULT 'DAY_SCHOLAR',
    `hostel_seat_id` CHAR(36) NULL,
    `transport_route_id` CHAR(36) NULL,
    `quota_tag` VARCHAR(40) NOT NULL DEFAULT 'NONE',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `IDX_ENROLL_SESSION_CLASS`(`academic_session_id`, `class_or_dept_id`),
    INDEX `IDX_ENROLL_STUDENT`(`student_id`),
    UNIQUE INDEX `uq_session_class_section_roll`(`academic_session_id`, `class_or_dept_id`, `section_or_batch_id`, `class_roll_no`),
    UNIQUE INDEX `uq_student_active_session`(`student_id`, `academic_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_invoice_lines` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `invoice_id` CHAR(36) NOT NULL,
    `fee_head_id` CHAR(36) NOT NULL,
    `gl_account_id` CHAR(36) NOT NULL,
    `fund_id` CHAR(36) NOT NULL,
    `cost_center_id` CHAR(36) NULL,
    `credit_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `gross_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `waiver_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `waiver_id` CHAR(36) NULL,
    `line_memo` VARCHAR(255) NULL,

    INDEX `FK_1e499a36b5cd17128be10d3b415`(`waiver_id`),
    INDEX `FK_9db5abe778ddab94285c1bdeed8`(`cost_center_id`),
    INDEX `FK_ab278aa704f6813f6a0f288e3d4`(`fee_head_id`),
    INDEX `FK_b795c15fd3b45859b6213f3a3ec`(`fund_id`),
    INDEX `FK_eb0be5e84e5b6c82e99d32db523`(`gl_account_id`),
    INDEX `IDX_INV_LINES_INVOICE`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_invoices` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `invoice_no` VARCHAR(30) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `billing_period` VARCHAR(30) NOT NULL,
    `issue_date` DATE NOT NULL,
    `due_date` DATE NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    `gross_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `waiver_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `paid_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `late_fine_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `fiscal_period_id` CHAR(36) NOT NULL,
    `journal_entry_id` CHAR(36) NULL,
    `cost_center_id` CHAR(36) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `narration` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_b34180c3c4b7dca8bfa4530b2a1`(`invoice_no`),
    INDEX `FK_528c0905688b9272b12a69c35ed`(`fiscal_period_id`),
    INDEX `FK_65542b0944b005443bdbf4756f3`(`cost_center_id`),
    INDEX `FK_f918f7c39bab56ef2a8850bb81d`(`journal_entry_id`),
    INDEX `IDX_INVOICES_DUE`(`due_date`),
    INDEX `IDX_INVOICES_STATUS`(`status`),
    INDEX `IDX_INVOICES_STUDENT`(`student_id`),
    UNIQUE INDEX `uq_invoice_student_period`(`student_id`, `billing_period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_previous_educations` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `student_id` CHAR(36) NOT NULL,
    `exam_title` VARCHAR(40) NOT NULL,
    `institute_name` VARCHAR(150) NOT NULL,
    `education_board` VARCHAR(40) NULL,
    `academic_group` VARCHAR(40) NULL,
    `roll_no` VARCHAR(30) NULL,
    `reg_no` VARCHAR(30) NULL,
    `passing_year` INTEGER NULL,
    `gpa_obtained` DECIMAL(4, 2) NULL,
    `gpa_scale` DECIMAL(4, 2) NOT NULL DEFAULT 5.00,
    `tc_number` VARCHAR(50) NULL,
    `tc_date` DATE NULL,

    INDEX `IDX_PREV_EDU_STUDENT`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_subject_enrollments` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `academic_session_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `syllabus_subject_id` CHAR(36) NOT NULL,
    `assigned_role` VARCHAR(30) NOT NULL,

    INDEX `FK_d9ddcc2f7e4b87d9813f9f3e193`(`syllabus_subject_id`),
    INDEX `IDX_SUB_ENROLL_SESSION`(`academic_session_id`, `student_id`),
    INDEX `IDX_SUB_ENROLL_STUDENT`(`student_id`),
    UNIQUE INDEX `uq_student_sub_enroll`(`academic_session_id`, `student_id`, `syllabus_subject_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_waivers` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `student_id` CHAR(36) NOT NULL,
    `waiver_type` VARCHAR(30) NOT NULL,
    `percent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `fixed_cap_amount` DECIMAL(15, 2) NULL,
    `contra_gl_id` CHAR(36) NULL,
    `fund_id` CHAR(36) NULL,
    `active_from` DATE NULL,
    `active_to` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `remark` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    `scope_billing_types` VARCHAR(60) NULL,

    INDEX `FK_94f15acf285950c2d0b85c54567`(`fund_id`),
    INDEX `FK_d322e215cde77b75f60af410074`(`contra_gl_id`),
    INDEX `IDX_WAIVERS_SCOPE`(`scope_billing_types`),
    INDEX `IDX_WAIVERS_STUDENT`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `student_unique_id` VARCHAR(30) NOT NULL,
    `govt_uid_crvs` VARCHAR(30) NULL,
    `family_profile_id` CHAR(36) NOT NULL,
    `full_name_en` VARCHAR(120) NOT NULL,
    `full_name_bn` VARCHAR(120) NULL,
    `gender` VARCHAR(15) NOT NULL,
    `date_of_birth` DATE NOT NULL,
    `birth_reg_no` VARCHAR(25) NULL,
    `national_id_no` VARCHAR(25) NULL,
    `religion` VARCHAR(25) NOT NULL,
    `blood_group` VARCHAR(10) NULL,
    `photo_url` VARCHAR(255) NULL,
    `medical_allergy_notes` TEXT NULL,
    `stipend_mfs_type` VARCHAR(20) NULL,
    `stipend_account_no` VARCHAR(30) NULL,
    `admission_date` DATE NOT NULL,
    `current_status` VARCHAR(25) NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    `pickup_guardian_name` VARCHAR(120) NULL,
    `pickup_guardian_phone` VARCHAR(20) NULL,
    `tc_number` VARCHAR(50) NULL,
    `tc_issue_date` DATE NULL,
    `tc_remark` VARCHAR(255) NULL,

    UNIQUE INDEX `UQ_643b46fc455dff465cda83b289a`(`student_unique_id`),
    UNIQUE INDEX `UQ_8d22ce0313314d70b8410dcd54f`(`govt_uid_crvs`),
    UNIQUE INDEX `UQ_572defa4aaf30e866caceb2aeff`(`birth_reg_no`),
    INDEX `IDX_STUDENTS_FAMILY`(`family_profile_id`),
    INDEX `IDX_STUDENTS_STATUS`(`current_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `tax_challan_items` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `challan_id` CHAR(36) NOT NULL,
    `vendor_bill_id` CHAR(36) NOT NULL,
    `tax_type` VARCHAR(10) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    INDEX `IDX_CHALLAN_ITEM_BILL`(`vendor_bill_id`),
    INDEX `IDX_CHALLAN_ITEM_CHALLAN`(`challan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `tax_challans` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `challan_no` VARCHAR(60) NOT NULL,
    `challan_date` DATE NOT NULL,
    `bank_gl_id` CHAR(36) NOT NULL,
    `deposit_bank_name` VARCHAR(120) NULL,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `gl_journal_id` CHAR(36) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'POSTED',
    `created_by_user_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_01d2b2741b161dabe3b9a90e672`(`challan_no`),
    INDEX `FK_8873912ce8258c482d44409d534`(`gl_journal_id`),
    INDEX `FK_d193b9ac044bd03087c2e49317d`(`created_by_user_id`),
    INDEX `FK_f9131bf1f77c9cf6496338e7879`(`bank_gl_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `teachers` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(150) NOT NULL,
    `name_bn` VARCHAR(150) NULL,
    `designation` VARCHAR(150) NOT NULL,
    `designation_bn` VARCHAR(150) NULL,
    `department` VARCHAR(150) NULL,
    `department_bn` VARCHAR(150) NULL,
    `image_url` VARCHAR(255) NULL,
    `joint_date` DATE NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `user_permissions` (
    `user_id` CHAR(36) NOT NULL,
    `permission_id` CHAR(36) NOT NULL,
    `assigned_by` CHAR(36) NULL,
    `assigned_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `FK_5dd800c5e91aa3997060508bf2e`(`assigned_by`),
    INDEX `FK_8145f5fadacd311693c15e41f10`(`permission_id`),
    PRIMARY KEY (`user_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'management', 'accountant', 'teacher', 'student', 'guardian') NOT NULL DEFAULT 'student',
    `phone` VARCHAR(20) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `last_login_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_97672ac88f789774dd47f7c8be3`(`email`),
    INDEX `IDX_USERS_EMAIL`(`email`),
    INDEX `IDX_USERS_ROLE`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `vendor_bills` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `bill_no` VARCHAR(30) NOT NULL,
    `vendor_id` CHAR(36) NOT NULL,
    `expense_gl_id` CHAR(36) NOT NULL,
    `fund_id` CHAR(36) NOT NULL,
    `cost_center_id` CHAR(36) NULL,
    `bill_date` DATE NOT NULL,
    `due_date` DATE NULL,
    `supplier_invoice_no` VARCHAR(60) NULL,
    `gross_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `tds_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `tds_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `vds_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `vds_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `net_payable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `paid_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `tds_remitted_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `vds_remitted_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `mushak_63_received` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `gl_journal_id` CHAR(36) NULL,
    `narration` VARCHAR(255) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_a56f55b1c6b1e55c66bd80362eb`(`bill_no`),
    INDEX `FK_0182d1c44fa5b860a14d0fcda06`(`created_by_user_id`),
    INDEX `FK_28d037073acb7c50b4dbae9736e`(`fund_id`),
    INDEX `FK_61e9c923e0ead2d238400684c43`(`gl_journal_id`),
    INDEX `FK_8559aeb8b449295787d733cd4be`(`expense_gl_id`),
    INDEX `FK_a577d0f1830fcf3c84556ec5b35`(`cost_center_id`),
    INDEX `IDX_BILL_DATE`(`bill_date`),
    INDEX `IDX_BILL_STATUS`(`status`),
    INDEX `IDX_BILL_VENDOR`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `vendor_code` VARCHAR(20) NULL,
    `vendor_name` VARCHAR(150) NOT NULL,
    `bin_no` VARCHAR(20) NULL,
    `trade_license_no` VARCHAR(60) NULL,
    `contact_person` VARCHAR(120) NULL,
    `contact_phone` VARCHAR(30) NULL,
    `address` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_6c20a7a81f96af980d5219cf463`(`vendor_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `voucher_sequences` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `fiscal_year` VARCHAR(9) NOT NULL,
    `voucher_type` VARCHAR(20) NOT NULL,
    `last_number` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_voucher_sequence_year_type`(`fiscal_year`, `voucher_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `waiver_preset_rules` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `rule_code` VARCHAR(40) NOT NULL,
    `rule_name` VARCHAR(120) NOT NULL,
    `institution_type` VARCHAR(25) NULL,
    `min_gpa` DECIMAL(4, 2) NULL,
    `max_gpa` DECIMAL(4, 2) NULL,
    `quota_tag` VARCHAR(40) NULL,
    `residence_type` VARCHAR(25) NULL,
    `waiver_type` VARCHAR(30) NOT NULL,
    `admission_fee_pct` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `tuition_fee_pct` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `requires_zakat_eligible` BOOLEAN NOT NULL DEFAULT false,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `remark` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `UQ_a03a00a14b798126c4df517eb00`(`rule_code`),
    INDEX `IDX_WAIVER_RULES_ACTIVE`(`is_active`, `priority`),
    INDEX `IDX_WAIVER_RULES_QUOTA`(`quota_tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- AddForeignKey
ALTER TABLE `accounting_audit_logs` ADD CONSTRAINT `FK_5cc7ad3d4322ee077af303a416c` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `adjunct_honorarium_bills` ADD CONSTRAINT `FK_4f289bec631bfba5cd9c4049b2e` FOREIGN KEY (`gl_journal_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `adjunct_honorarium_bills` ADD CONSTRAINT `FK_7f39a395e294512630a28f76aef` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `adjunct_honorarium_bills` ADD CONSTRAINT `FK_ce9decd83d40698cd87796eb5ae` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `adjunct_honorarium_bills` ADD CONSTRAINT `FK_f4a75afd9e3f9a1b79e3da340e3` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `admission_applications` ADD CONSTRAINT `FK_4c7f324b23124b4609841a16cae` FOREIGN KEY (`campaign_id`) REFERENCES `admission_campaigns`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `admission_applications` ADD CONSTRAINT `FK_ebba2cd78268c80e1d1b4f6d959` FOREIGN KEY (`admitted_student_id`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `FK_coa_default_fund` FOREIGN KEY (`default_fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `FK_coa_parent` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `class_syllabus_subjects` ADD CONSTRAINT `FK_6db9c01b5b77757cb51ec8963dd` FOREIGN KEY (`subject_id`) REFERENCES `academic_subjects`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `cost_centers` ADD CONSTRAINT `FK_cost_centers_parent` FOREIGN KEY (`parent_id`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fee_heads` ADD CONSTRAINT `FK_45728218dd0533dafc4098d578f` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fee_heads` ADD CONSTRAINT `FK_75669e4129d2d9b6c0765641287` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `fee_heads` ADD CONSTRAINT `FK_a174486d2c8d482b9116f633548` FOREIGN KEY (`revenue_gl_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `FK_0cd1b7a9f4a2dbb2006af7527bd` FOREIGN KEY (`reversed_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `FK_1845d906faef6586c6d1ac639a9` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `FK_77fe13fb6db6b1fea4ff4d70cd2` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `FK_dfb001500889ba5445dcebedf7e` FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_periods`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `FK_e9a1725d8c4972d7d672a7d5ecd` FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `FK_1fd23ae91f0c24764b4e581c72e` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `FK_29bf92dbf024d23a9bebeea8cf5` FOREIGN KEY (`gl_account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `FK_7002186b79482768d2a8048aca7` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `FK_a250afb08d8ae2e62629c60e100` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `FK_MENU_ITEMS_PARENT` FOREIGN KEY (`parent_id`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_collections` ADD CONSTRAINT `FK_2f480bd26e010da3f88fdb5ca89` FOREIGN KEY (`invoice_id`) REFERENCES `student_invoices`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_collections` ADD CONSTRAINT `FK_553921c63cd12349c268f20d478` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_collections` ADD CONSTRAINT `FK_a2ea2f79498def55cbe883c97a0` FOREIGN KEY (`cash_gl_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_collections` ADD CONSTRAINT `FK_b149022fe7461319e295a983900` FOREIGN KEY (`gl_journal_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `FK_2784638bcb4961f09de25ceb871` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `FK_6c1c3e51a85243dc4e7b981e2b9` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `FK_c79243d7310cc718d3d7207b64e` FOREIGN KEY (`payment_journal_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `FK_d55de221adb3b66278c1f66681a` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `FK_e7fda897ba99ea795bf9a22b4e7` FOREIGN KEY (`gl_journal_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payslip_lines` ADD CONSTRAINT `FK_dc4ee2b2653728dd07f13455c9c` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `permissions` ADD CONSTRAINT `FK_738f46bb9ac6ea356f1915835d0` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_caution_deposits` ADD CONSTRAINT `FK_fc4ae3d9ab90adc7384becbe386` FOREIGN KEY (`gl_account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `FK_8b0e086cbeca4ba69aadaac8541` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `FK_9a1617311db9e7e586ab9bc05a9` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_enrollments` ADD CONSTRAINT `FK_08caafd8a026a19ecf54db0e958` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoice_lines` ADD CONSTRAINT `FK_035bf01694d659913f736a76672` FOREIGN KEY (`invoice_id`) REFERENCES `student_invoices`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoice_lines` ADD CONSTRAINT `FK_1e499a36b5cd17128be10d3b415` FOREIGN KEY (`waiver_id`) REFERENCES `student_waivers`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoice_lines` ADD CONSTRAINT `FK_9db5abe778ddab94285c1bdeed8` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoice_lines` ADD CONSTRAINT `FK_ab278aa704f6813f6a0f288e3d4` FOREIGN KEY (`fee_head_id`) REFERENCES `fee_heads`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoice_lines` ADD CONSTRAINT `FK_b795c15fd3b45859b6213f3a3ec` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoice_lines` ADD CONSTRAINT `FK_eb0be5e84e5b6c82e99d32db523` FOREIGN KEY (`gl_account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoices` ADD CONSTRAINT `FK_528c0905688b9272b12a69c35ed` FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_periods`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoices` ADD CONSTRAINT `FK_65542b0944b005443bdbf4756f3` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_invoices` ADD CONSTRAINT `FK_f918f7c39bab56ef2a8850bb81d` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_previous_educations` ADD CONSTRAINT `FK_cd587085933a1a022c90c31d545` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_subject_enrollments` ADD CONSTRAINT `FK_d9ddcc2f7e4b87d9813f9f3e193` FOREIGN KEY (`syllabus_subject_id`) REFERENCES `class_syllabus_subjects`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_waivers` ADD CONSTRAINT `FK_94f15acf285950c2d0b85c54567` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_waivers` ADD CONSTRAINT `FK_d322e215cde77b75f60af410074` FOREIGN KEY (`contra_gl_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `FK_d0964695550b73c47dcc55b6f80` FOREIGN KEY (`family_profile_id`) REFERENCES `family_profiles`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tax_challan_items` ADD CONSTRAINT `FK_147d7f26963dabed76013224c11` FOREIGN KEY (`vendor_bill_id`) REFERENCES `vendor_bills`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tax_challan_items` ADD CONSTRAINT `FK_318ca8a2147e43329eec9c0a65a` FOREIGN KEY (`challan_id`) REFERENCES `tax_challans`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tax_challans` ADD CONSTRAINT `FK_8873912ce8258c482d44409d534` FOREIGN KEY (`gl_journal_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tax_challans` ADD CONSTRAINT `FK_d193b9ac044bd03087c2e49317d` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tax_challans` ADD CONSTRAINT `FK_f9131bf1f77c9cf6496338e7879` FOREIGN KEY (`bank_gl_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `FK_3495bd31f1862d02931e8e8d2e8` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `FK_5dd800c5e91aa3997060508bf2e` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `FK_8145f5fadacd311693c15e41f10` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `vendor_bills` ADD CONSTRAINT `FK_0182d1c44fa5b860a14d0fcda06` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `vendor_bills` ADD CONSTRAINT `FK_28d037073acb7c50b4dbae9736e` FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `vendor_bills` ADD CONSTRAINT `FK_61e9c923e0ead2d238400684c43` FOREIGN KEY (`gl_journal_id`) REFERENCES `journal_entries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `vendor_bills` ADD CONSTRAINT `FK_6f4bf16a8536ae1bdf7f8ad6ed4` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `vendor_bills` ADD CONSTRAINT `FK_8559aeb8b449295787d733cd4be` FOREIGN KEY (`expense_gl_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `vendor_bills` ADD CONSTRAINT `FK_a577d0f1830fcf3c84556ec5b35` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

