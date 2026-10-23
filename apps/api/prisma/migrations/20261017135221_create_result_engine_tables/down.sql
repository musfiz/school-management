-- down.sql — rollback for 20261017135221_create_result_engine_tables
-- Reverses migration.sql. Generated with prisma migrate diff between the
-- migration states before/after this migration — do NOT hand-edit.
-- Applied by: npm run db:rollback
-- DropForeignKey
ALTER TABLE `exam_subject_components` DROP FOREIGN KEY `FK_exam_components_syllabus`;

-- DropForeignKey
ALTER TABLE `exam_subject_components` DROP FOREIGN KEY `FK_exam_components_term`;

-- DropForeignKey
ALTER TABLE `exam_term_weights` DROP FOREIGN KEY `FK_term_weights_child`;

-- DropForeignKey
ALTER TABLE `exam_term_weights` DROP FOREIGN KEY `FK_term_weights_parent`;

-- DropForeignKey
ALTER TABLE `exam_terms` DROP FOREIGN KEY `FK_exam_terms_parent`;

-- DropForeignKey
ALTER TABLE `exam_terms` DROP FOREIGN KEY `FK_exam_terms_scale`;

-- DropForeignKey
ALTER TABLE `grading_scale_ranges` DROP FOREIGN KEY `FK_grading_ranges_scale`;

-- DropForeignKey
ALTER TABLE `result_generation_jobs` DROP FOREIGN KEY `FK_result_jobs_requested_by`;

-- DropForeignKey
ALTER TABLE `result_generation_jobs` DROP FOREIGN KEY `FK_result_jobs_term`;

-- DropForeignKey
ALTER TABLE `student_attendance_summaries` DROP FOREIGN KEY `FK_attendance_summaries_student`;

-- DropForeignKey
ALTER TABLE `student_attendance_summaries` DROP FOREIGN KEY `FK_attendance_summaries_term`;

-- DropForeignKey
ALTER TABLE `student_component_marks` DROP FOREIGN KEY `FK_student_component_marks_component`;

-- DropForeignKey
ALTER TABLE `student_component_marks` DROP FOREIGN KEY `FK_student_component_marks_entered_by`;

-- DropForeignKey
ALTER TABLE `student_component_marks` DROP FOREIGN KEY `FK_student_component_marks_student`;

-- DropForeignKey
ALTER TABLE `student_component_marks` DROP FOREIGN KEY `FK_student_component_marks_syllabus`;

-- DropForeignKey
ALTER TABLE `student_component_marks` DROP FOREIGN KEY `FK_student_component_marks_term`;

-- DropForeignKey
ALTER TABLE `student_subject_results` DROP FOREIGN KEY `FK_subject_results_student`;

-- DropForeignKey
ALTER TABLE `student_subject_results` DROP FOREIGN KEY `FK_subject_results_syllabus`;

-- DropForeignKey
ALTER TABLE `student_subject_results` DROP FOREIGN KEY `FK_subject_results_term`;

-- DropForeignKey
ALTER TABLE `student_term_marksheets` DROP FOREIGN KEY `FK_term_marksheets_student`;

-- DropForeignKey
ALTER TABLE `student_term_marksheets` DROP FOREIGN KEY `FK_term_marksheets_term`;

-- AlterTable
ALTER TABLE `users` MODIFY `role` enum('admin','management','accountant','teacher','student','guardian') NOT NULL DEFAULT 'student';

-- DropTable
DROP TABLE `attendance_mark_slabs`;

-- DropTable
DROP TABLE `exam_subject_components`;

-- DropTable
DROP TABLE `exam_term_weights`;

-- DropTable
DROP TABLE `exam_terms`;

-- DropTable
DROP TABLE `grading_scale_ranges`;

-- DropTable
DROP TABLE `grading_scales`;

-- DropTable
DROP TABLE `result_generation_jobs`;

-- DropTable
DROP TABLE `student_attendance_summaries`;

-- DropTable
DROP TABLE `student_component_marks`;

-- DropTable
DROP TABLE `student_subject_results`;

-- DropTable
DROP TABLE `student_term_marksheets`;

