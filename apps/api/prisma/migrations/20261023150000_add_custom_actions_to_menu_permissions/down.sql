-- down.sql — rollback for 20261023150000_add_custom_actions_to_menu_permissions
-- Reverses migration.sql. Generated with prisma migrate diff between the
-- migration states before/after this migration — do NOT hand-edit.
-- Applied by: npm run db:rollback
-- AlterTable
ALTER TABLE `menu_user_permissions` DROP COLUMN `custom_actions`;

-- AlterTable
ALTER TABLE `menus` DROP COLUMN `actions_config`;

-- AlterTable
ALTER TABLE `role_default_permissions` DROP COLUMN `custom_actions`;

