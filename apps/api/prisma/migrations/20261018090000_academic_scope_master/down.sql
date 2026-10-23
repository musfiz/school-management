-- down.sql — rollback for 20261018090000_academic_scope_master
-- Reverses migration.sql. Generated with prisma migrate diff between the
-- migration states before/after this migration — do NOT hand-edit.
-- Applied by: npm run db:rollback
-- DropTable
DROP TABLE `academic_sessions`;

-- DropTable
DROP TABLE `class_or_depts`;

