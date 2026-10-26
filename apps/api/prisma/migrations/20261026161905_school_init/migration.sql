/*
  Warnings:

  - You are about to drop the `galleries` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `menu_user_permissions` DROP FOREIGN KEY `FK_menu_user_perm_menu`;

-- DropForeignKey
ALTER TABLE `menu_user_permissions` DROP FOREIGN KEY `FK_menu_user_perm_user`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `is_super_admin` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `galleries`;
