-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('admin', 'management', 'accountant', 'teacher', 'student', 'guardian', 'exam_controller') NOT NULL DEFAULT 'student';

-- CreateTable
CREATE TABLE `attendance_mark_slabs` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(100) NOT NULL,
    `min_attendance_pct` DECIMAL(5, 2) NOT NULL,
    `max_attendance_pct` DECIMAL(5, 2) NOT NULL,
    `awarded_marks` DECIMAL(5, 2) NOT NULL,

    INDEX `IDX_ATT_SLAB_MIN`(`min_attendance_pct`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `exam_subject_components` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `exam_term_id` CHAR(36) NOT NULL,
    `syllabus_subject_id` CHAR(36) NOT NULL,
    `component_code` VARCHAR(30) NOT NULL,
    `component_name` VARCHAR(60) NOT NULL,
    `source_type` VARCHAR(30) NOT NULL DEFAULT 'MANUAL_ENTRY',
    `source_component_code` VARCHAR(30) NULL,
    `max_raw_marks` DECIMAL(6, 2) NOT NULL,
    `conversion_weight_pct` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    `converted_max_marks` DECIMAL(6, 2) NOT NULL,
    `min_pass_marks` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `display_order` INTEGER NOT NULL DEFAULT 1,

    INDEX `IDX_EXAM_COMPONENTS_TERM_SUBJECT`(`exam_term_id`, `syllabus_subject_id`),
    INDEX `FK_exam_components_syllabus`(`syllabus_subject_id`),
    UNIQUE INDEX `uq_exam_subject_components`(`exam_term_id`, `syllabus_subject_id`, `component_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `exam_term_weights` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `parent_exam_term_id` CHAR(36) NOT NULL,
    `child_exam_term_id` CHAR(36) NOT NULL,
    `weight_pct` DECIMAL(5, 2) NOT NULL,

    INDEX `FK_term_weights_child`(`child_exam_term_id`),
    UNIQUE INDEX `uq_exam_term_weights`(`parent_exam_term_id`, `child_exam_term_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `exam_terms` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `academic_session_id` CHAR(36) NOT NULL,
    `class_or_dept_id` CHAR(36) NOT NULL,
    `grading_scale_id` CHAR(36) NOT NULL,
    `term_name` VARCHAR(100) NOT NULL,
    `term_type` VARCHAR(30) NOT NULL,
    `parent_terminal_exam_id` CHAR(36) NULL,
    `sequence_no` INTEGER NOT NULL DEFAULT 1,
    `ct_aggregation_mode` VARCHAR(30) NOT NULL DEFAULT 'BEST_N_AVERAGE',
    `ct_best_count` INTEGER NOT NULL DEFAULT 2,
    `annual_weight_pct` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    `mark_rounding_mode` VARCHAR(20) NOT NULL DEFAULT 'HALF_UP_INTEGER',
    `min_courses_to_promote` INTEGER NOT NULL DEFAULT 0,
    `min_cgpa_to_promote` DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(20) NOT NULL DEFAULT 'SETUP',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `IDX_EXAM_TERMS_SESSION_CLASS`(`academic_session_id`, `class_or_dept_id`),
    INDEX `FK_exam_terms_parent`(`parent_terminal_exam_id`),
    INDEX `IDX_EXAM_TERMS_STATUS`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `grading_scale_ranges` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `grading_scale_id` CHAR(36) NOT NULL,
    `min_percentage` DECIMAL(5, 2) NOT NULL,
    `max_percentage` DECIMAL(5, 2) NOT NULL,
    `letter_grade` VARCHAR(10) NOT NULL,
    `grade_point` DECIMAL(4, 2) NOT NULL,
    `descriptive_remark` VARCHAR(100) NULL,

    INDEX `IDX_GRADING_RANGES_SCALE_MIN`(`grading_scale_id`, `min_percentage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `grading_scales` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(100) NOT NULL,
    `scale_type` VARCHAR(30) NOT NULL,
    `max_point` DECIMAL(4, 2) NOT NULL,
    `min_pass_point` DECIMAL(4, 2) NOT NULL,
    `min_pass_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 33.00,
    `fourth_subject_deduction` DECIMAL(4, 2) NOT NULL DEFAULT 2.00,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `IDX_GRADING_SCALES_ACTIVE`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `result_generation_jobs` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `exam_term_id` CHAR(36) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    `progress_pct` INTEGER NOT NULL DEFAULT 0,
    `current_stage` VARCHAR(60) NULL,
    `total_students` INTEGER NOT NULL DEFAULT 0,
    `processed_students` INTEGER NOT NULL DEFAULT 0,
    `error_message` VARCHAR(500) NULL,
    `requested_by` CHAR(36) NULL,
    `started_at` TIMESTAMP(0) NULL,
    `finished_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `IDX_RESULT_JOBS_TERM_STATUS`(`exam_term_id`, `status`),
    INDEX `FK_result_jobs_requested_by`(`requested_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_attendance_summaries` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `exam_term_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `attendance_percentage` DECIMAL(5, 2) NOT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `FK_attendance_summaries_student`(`student_id`),
    UNIQUE INDEX `uq_attendance_summaries`(`exam_term_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_component_marks` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `exam_term_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `syllabus_subject_id` CHAR(36) NOT NULL,
    `component_id` CHAR(36) NOT NULL,
    `raw_marks_obtained` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `converted_marks` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `is_absent` BOOLEAN NOT NULL DEFAULT false,
    `is_exempted` BOOLEAN NOT NULL DEFAULT false,
    `is_passed_component` BOOLEAN NOT NULL DEFAULT true,
    `entered_by` CHAR(36) NOT NULL,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    INDEX `IDX_STUDENT_COMP_MARKS_TERM_SUBJECT`(`exam_term_id`, `syllabus_subject_id`),
    INDEX `IDX_STUDENT_COMP_MARKS_STUDENT`(`student_id`),
    INDEX `FK_student_component_marks_syllabus`(`syllabus_subject_id`),
    INDEX `FK_student_component_marks_component`(`component_id`),
    INDEX `FK_student_component_marks_entered_by`(`entered_by`),
    UNIQUE INDEX `uq_student_exam_comp`(`exam_term_id`, `student_id`, `component_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_subject_results` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `exam_term_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `syllabus_subject_id` CHAR(36) NULL,
    `combined_group_code` VARCHAR(40) NULL,
    `is_merged_summary_row` BOOLEAN NOT NULL DEFAULT false,
    `assigned_role` VARCHAR(30) NOT NULL,
    `credit_hours` DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    `full_marks` DECIMAL(6, 2) NOT NULL,
    `component_breakdown_json` TEXT NULL,
    `total_obtained_marks` DECIMAL(6, 2) NOT NULL,
    `highest_marks_in_class` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `percentage_marks` DECIMAL(5, 2) NOT NULL,
    `letter_grade` VARCHAR(10) NOT NULL,
    `grade_point` DECIMAL(4, 2) NOT NULL,
    `effective_gp_for_gpa` DECIMAL(4, 2) NOT NULL,
    `weighted_credit_points` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `is_passed` BOOLEAN NOT NULL,
    `fail_reason` VARCHAR(100) NULL,

    INDEX `IDX_SUBJECT_RESULTS_TERM_ROLE`(`exam_term_id`, `assigned_role`),
    INDEX `IDX_SUBJECT_RESULTS_TERM_MERGED`(`exam_term_id`, `is_merged_summary_row`),
    INDEX `FK_subject_results_student`(`student_id`),
    INDEX `FK_subject_results_syllabus`(`syllabus_subject_id`),
    UNIQUE INDEX `uq_result_subject`(`exam_term_id`, `student_id`, `syllabus_subject_id`),
    UNIQUE INDEX `uq_result_merged`(`exam_term_id`, `student_id`, `combined_group_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- CreateTable
CREATE TABLE `student_term_marksheets` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `exam_term_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `section_id` CHAR(36) NULL,
    `shift_id` CHAR(36) NULL,
    `total_compulsory_subjects` INTEGER NOT NULL,
    `total_credits_attempted` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `total_credits_earned` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `marks_without_fourth` DECIMAL(8, 2) NOT NULL,
    `marks_with_fourth` DECIMAL(8, 2) NOT NULL,
    `gpa_without_fourth` DECIMAL(4, 2) NOT NULL,
    `fourth_subject_bonus_gp` DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    `final_gpa_or_cgpa` DECIMAL(4, 2) NOT NULL,
    `final_letter_grade` VARCHAR(10) NOT NULL,
    `failed_subject_count` INTEGER NOT NULL DEFAULT 0,
    `attendance_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    `result_status` VARCHAR(30) NOT NULL,
    `merit_position_section` INTEGER NULL,
    `merit_position_class` INTEGER NULL,
    `merit_position_shift` INTEGER NULL,
    `principal_remark` VARCHAR(255) NULL,
    `generated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `IDX_TERM_MARKSHEETS_TERM_SECTION`(`exam_term_id`, `section_id`),
    INDEX `IDX_TERM_MARKSHEETS_TERM_SHIFT`(`exam_term_id`, `shift_id`),
    INDEX `IDX_TERM_MARKSHEETS_TERM_GPA`(`exam_term_id`, `final_gpa_or_cgpa`),
    INDEX `IDX_TERM_MARKSHEETS_TERM_STATUS`(`exam_term_id`, `result_status`),
    INDEX `FK_term_marksheets_student`(`student_id`),
    UNIQUE INDEX `uq_term_marksheet`(`exam_term_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- AddForeignKey
ALTER TABLE `exam_subject_components` ADD CONSTRAINT `FK_exam_components_syllabus` FOREIGN KEY (`syllabus_subject_id`) REFERENCES `class_syllabus_subjects`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exam_subject_components` ADD CONSTRAINT `FK_exam_components_term` FOREIGN KEY (`exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exam_term_weights` ADD CONSTRAINT `FK_term_weights_child` FOREIGN KEY (`child_exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exam_term_weights` ADD CONSTRAINT `FK_term_weights_parent` FOREIGN KEY (`parent_exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exam_terms` ADD CONSTRAINT `FK_exam_terms_scale` FOREIGN KEY (`grading_scale_id`) REFERENCES `grading_scales`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exam_terms` ADD CONSTRAINT `FK_exam_terms_parent` FOREIGN KEY (`parent_terminal_exam_id`) REFERENCES `exam_terms`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `grading_scale_ranges` ADD CONSTRAINT `FK_grading_ranges_scale` FOREIGN KEY (`grading_scale_id`) REFERENCES `grading_scales`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `result_generation_jobs` ADD CONSTRAINT `FK_result_jobs_term` FOREIGN KEY (`exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `result_generation_jobs` ADD CONSTRAINT `FK_result_jobs_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_attendance_summaries` ADD CONSTRAINT `FK_attendance_summaries_term` FOREIGN KEY (`exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_attendance_summaries` ADD CONSTRAINT `FK_attendance_summaries_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_component_marks` ADD CONSTRAINT `FK_student_component_marks_syllabus` FOREIGN KEY (`syllabus_subject_id`) REFERENCES `class_syllabus_subjects`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_component_marks` ADD CONSTRAINT `FK_student_component_marks_component` FOREIGN KEY (`component_id`) REFERENCES `exam_subject_components`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_component_marks` ADD CONSTRAINT `FK_student_component_marks_term` FOREIGN KEY (`exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_component_marks` ADD CONSTRAINT `FK_student_component_marks_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_component_marks` ADD CONSTRAINT `FK_student_component_marks_entered_by` FOREIGN KEY (`entered_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_subject_results` ADD CONSTRAINT `FK_subject_results_syllabus` FOREIGN KEY (`syllabus_subject_id`) REFERENCES `class_syllabus_subjects`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_subject_results` ADD CONSTRAINT `FK_subject_results_term` FOREIGN KEY (`exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_subject_results` ADD CONSTRAINT `FK_subject_results_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_term_marksheets` ADD CONSTRAINT `FK_term_marksheets_term` FOREIGN KEY (`exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `student_term_marksheets` ADD CONSTRAINT `FK_term_marksheets_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
