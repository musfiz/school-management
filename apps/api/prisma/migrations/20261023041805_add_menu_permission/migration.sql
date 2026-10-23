/*
  Warnings:

  - You are about to drop the column `can_create` on the `menu_user_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_delete` on the `menu_user_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_edit` on the `menu_user_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_view` on the `menu_user_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_create` on the `role_default_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_delete` on the `role_default_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_edit` on the `role_default_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `can_view` on the `role_default_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `is_super_admin` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `menu_user_permissions` DROP FOREIGN KEY `FK_menu_user_perm_menu`;

-- DropForeignKey
ALTER TABLE `menu_user_permissions` DROP FOREIGN KEY `FK_menu_user_perm_user`;

-- DropForeignKey
ALTER TABLE `menus` DROP FOREIGN KEY `FK_menu_parent`;

-- DropForeignKey
ALTER TABLE `role_default_permissions` DROP FOREIGN KEY `FK_role_default_menu`;

-- DropIndex
DROP INDEX `FK_menu_user_perm_menu` ON `menu_user_permissions`;

-- DropIndex
DROP INDEX `FK_role_default_menu` ON `role_default_permissions`;

-- AlterTable
ALTER TABLE `exam_term_types` ALTER COLUMN `engine_behavior` DROP DEFAULT;

-- AlterTable
ALTER TABLE `menu_user_permissions` DROP COLUMN `can_create`,
    DROP COLUMN `can_delete`,
    DROP COLUMN `can_edit`,
    DROP COLUMN `can_view`,
    ADD COLUMN `canCreate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canDelete` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canEdit` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canView` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `role_default_permissions` DROP COLUMN `can_create`,
    DROP COLUMN `can_delete`,
    DROP COLUMN `can_edit`,
    DROP COLUMN `can_view`,
    ADD COLUMN `canCreate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canDelete` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canEdit` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canView` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `is_super_admin`,
    ADD COLUMN `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `role` ENUM('superadmin', 'admin', 'management', 'accountant', 'teacher', 'student', 'guardian', 'exam_controller') NOT NULL DEFAULT 'student';

-- CreateTable
CREATE TABLE `section_or_batches` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(100) NOT NULL,
    `section_code` VARCHAR(20) NOT NULL,
    `description` VARCHAR(255) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_section_or_batches_code`(`section_code`),
    INDEX `IDX_SECTION_OR_BATCHES_ACTIVE`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_groups` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(100) NOT NULL,
    `group_code` VARCHAR(20) NOT NULL,
    `description` VARCHAR(255) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_academic_groups_code`(`group_code`),
    INDEX `IDX_ACADEMIC_GROUPS_ACTIVE`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `menus` ADD CONSTRAINT `menus_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `menus`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_default_permissions` ADD CONSTRAINT `FK_role_default_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_user_permissions` ADD CONSTRAINT `FK_menu_user_perm_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_user_permissions` ADD CONSTRAINT `FK_menu_user_perm_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
