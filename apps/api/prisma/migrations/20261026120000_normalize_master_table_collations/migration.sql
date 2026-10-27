-- Normalize the utf8mb4 collations of the master-data tables that were created
-- without an explicit COLLATE clause: 20261018090000_academic_scope_master
-- (academic_sessions, class_or_depts) and 20261018100000_exam_term_types.
--
-- `DEFAULT CHARSET=utf8mb4` with no COLLATE resolves to the *charset's* default
-- collation, which is server dependent: MariaDB 11 uses utf8mb4_uca1400_ai_ci,
-- MySQL 8 uses utf8mb4_0900_ai_ci. Those three tables therefore ended up out of
-- step with the other 63 tables in this schema (utf8mb4_general_ci), which:
--   * breaks foreign keys whose columns are utf8mb4_general_ci /
--     utf8mb4_unicode_ci (errno 150) — see 20261027000000_create_routines;
--   * breaks joins between them and the rest of the schema with
--     ER_CANT_AGGREGATE_2COLLATIONS (1267, "Illegal mix of collations"),
--     e.g. `student_enrollments.academic_session_id = academic_sessions.id`.
--
-- utf8mb4_general_ci is both the schema default and the collation of every
-- existing *_id column that points at these master tables, so align the
-- stragglers with it instead of converting ~60 tables the other way.
--
-- All four tables hold master data only and participate in no foreign key, so
-- the rebuild is safe and ordering independent.
ALTER TABLE `academic_sessions` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `class_or_depts` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `academic_groups` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `exam_term_types` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
