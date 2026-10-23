-- down.sql — rollback for 20261018100000_exam_term_types
-- Reverses migration.sql. Generated with prisma migrate diff between the
-- migration states before/after this migration — do NOT hand-edit.
-- Applied by: npm run db:rollback
-- DropTable
DROP TABLE `exam_term_types`;

