-- AlterTable
ALTER TABLE `menus` ADD COLUMN `actions_config` JSON NULL;

-- AlterTable
ALTER TABLE `role_default_permissions` ADD COLUMN `custom_actions` JSON NULL;

-- AlterTable
ALTER TABLE `menu_user_permissions` ADD COLUMN `custom_actions` JSON NULL;
