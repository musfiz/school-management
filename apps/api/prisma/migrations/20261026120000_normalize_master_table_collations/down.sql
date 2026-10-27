-- down.sql — rollback for 20261026120000_normalize_master_table_collations
-- Reverses migration.sql by rebuilding the four master-data tables with the
-- charset default collation they had before the migration (the value is
-- server dependent: utf8mb4_uca1400_ai_ci on MariaDB 11, utf8mb4_0900_ai_ci on
-- MySQL 8). Hand-written on purpose — `prisma migrate diff` cannot express a
-- collation-only change.
-- Applied by: npm run db:rollback
--
-- Note: rolling this back re-introduces the collation mismatch that made
-- 20261027000000_create_routines fail, so only roll back together with that
-- migration.
ALTER TABLE `academic_sessions` CONVERT TO CHARACTER SET utf8mb4;

ALTER TABLE `class_or_depts` CONVERT TO CHARACTER SET utf8mb4;

ALTER TABLE `academic_groups` CONVERT TO CHARACTER SET utf8mb4;

ALTER TABLE `exam_term_types` CONVERT TO CHARACTER SET utf8mb4;
