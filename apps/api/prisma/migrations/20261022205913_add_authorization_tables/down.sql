-- down.sql — rollback for 20261022205913_add_authorization_tables
-- Reverses migration.sql. Generated with prisma migrate diff between the
-- migration states before/after this migration — do NOT hand-edit.
-- Applied by: npm run db:rollback
-- DropForeignKey
ALTER TABLE `menu_user_permissions` DROP FOREIGN KEY `FK_menu_user_perm_menu`;

-- DropForeignKey
ALTER TABLE `menu_user_permissions` DROP FOREIGN KEY `FK_menu_user_perm_user`;

-- DropForeignKey
ALTER TABLE `menus` DROP FOREIGN KEY `FK_menu_parent`;

-- DropForeignKey
ALTER TABLE `role_default_permissions` DROP FOREIGN KEY `FK_role_default_menu`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `is_super_admin`;

-- DropTable
DROP TABLE `menu_user_permissions`;

-- DropTable
DROP TABLE `menus`;

-- DropTable
DROP TABLE `role_default_permissions`;

