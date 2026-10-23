-- down.sql — rollback for 20261017153015_fix_merged_row_unique_index
-- Reverses migration.sql. Generated with prisma migrate diff between the
-- migration states before/after this migration — do NOT hand-edit.
-- Applied by: npm run db:rollback
-- DropForeignKey
ALTER TABLE `student_subject_results` DROP FOREIGN KEY `FK_subject_results_term`;

-- DropIndex
DROP INDEX `IDX_SUBJECT_RESULTS_TERM_STUDENT_GROUP` ON `student_subject_results`;

-- CreateIndex
CREATE UNIQUE INDEX `uq_result_merged` ON `student_subject_results`(`exam_term_id` ASC, `student_id` ASC, `combined_group_code` ASC);

-- AddForeignKey
ALTER TABLE `student_subject_results` ADD CONSTRAINT `FK_subject_results_term` FOREIGN KEY (`exam_term_id`) REFERENCES `exam_terms`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

