-- down.sql — rollback for 20261023041805_add_menu_permission
-- Reverses migration.sql. Generated with prisma migrate diff between the
-- migration states before/after this migration — do NOT hand-edit.
-- Applied by: npm run db:rollback
-- DropForeignKey
ALTER TABLE `menu_user_permissions` DROP FOREIGN KEY `FK_menu_user_perm_menu`;

-- DropForeignKey
ALTER TABLE `menu_user_permissions` DROP FOREIGN KEY `FK_menu_user_perm_user`;

-- DropForeignKey
ALTER TABLE `menus` DROP FOREIGN KEY `menus_parent_id_fkey`;

-- DropForeignKey
ALTER TABLE `role_default_permissions` DROP FOREIGN KEY `FK_role_default_menu`;

-- AlterTable
ALTER TABLE `exam_term_types` MODIFY `engine_behavior` varchar(30) NOT NULL DEFAULT 'TERMINAL';

-- AlterTable
ALTER TABLE `menu_user_permissions` DROP COLUMN `canCreate`,
    DROP COLUMN `canDelete`,
    DROP COLUMN `canEdit`,
    DROP COLUMN `canView`,
    ADD COLUMN `can_create` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `can_delete` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `can_edit` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `can_view` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `role_default_permissions` DROP COLUMN `canCreate`,
    DROP COLUMN `canDelete`,
    DROP COLUMN `canEdit`,
    DROP COLUMN `canView`,
    ADD COLUMN `can_create` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `can_delete` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `can_edit` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `can_view` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `isSuperAdmin`,
    ADD COLUMN `is_super_admin` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `academic_groups`;

-- DropTable
DROP TABLE `section_or_batches`;

-- AddForeignKey
ALTER TABLE `menu_user_permissions` ADD CONSTRAINT `FK_menu_user_perm_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `menu_user_permissions` ADD CONSTRAINT `FK_menu_user_perm_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `menus` ADD CONSTRAINT `FK_menu_parent` FOREIGN KEY (`parent_id`) REFERENCES `menus`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_default_permissions` ADD CONSTRAINT `FK_role_default_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

