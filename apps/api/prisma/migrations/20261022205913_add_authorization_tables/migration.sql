-- Authorization: Menu + hybrid role/user permission tables.
-- Adds `menus`, `role_default_permissions`, `menu_user_permissions`, plus
-- `is_super_admin` on `users`. Idempotent where practical.

-- 1) Menus (hierarchical, slug-based)
CREATE TABLE IF NOT EXISTS `menus` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `title` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `path` VARCHAR(255) NULL,
  `icon` VARCHAR(100) NULL,
  `parent_id` CHAR(36) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UQ_menu_slug`(`slug`),
  INDEX `FK_menu_parent`(`parent_id`),
  INDEX `IDX_MENU_SLUG`(`slug`),
  CONSTRAINT `FK_menu_parent` FOREIGN KEY (`parent_id`) REFERENCES `menus`(`id`) ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2) Role default permission templates (one per role x menu)
CREATE TABLE IF NOT EXISTS `role_default_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role` ENUM('superadmin','admin','management','accountant','teacher','student','guardian','exam_controller') NOT NULL,
  `menu_id` CHAR(36) NOT NULL,
  `can_view` TINYINT(1) NOT NULL DEFAULT 0,
  `can_create` TINYINT(1) NOT NULL DEFAULT 0,
  `can_edit` TINYINT(1) NOT NULL DEFAULT 0,
  `can_delete` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_role_default_permission`(`role`, `menu_id`),
  INDEX `FK_role_default_menu`(`menu_id`),
  CONSTRAINT `FK_role_default_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3) Per-user menu permissions (overrides role defaults)
CREATE TABLE IF NOT EXISTS `menu_user_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` CHAR(36) NOT NULL,
  `menu_id` CHAR(36) NOT NULL,
  `can_view` TINYINT(1) NOT NULL DEFAULT 0,
  `can_create` TINYINT(1) NOT NULL DEFAULT 0,
  `can_edit` TINYINT(1) NOT NULL DEFAULT 0,
  `can_delete` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_menu_user_permission`(`user_id`, `menu_id`),
  INDEX `FK_menu_user_perm_user`(`user_id`),
  INDEX `FK_menu_user_perm_menu`(`menu_id`),
  CONSTRAINT `FK_menu_user_perm_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_menu_user_perm_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4) SUPERADMIN flag on users (idempotent)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_super_admin'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `is_super_admin` TINYINT(1) NOT NULL DEFAULT 0 AFTER `role`',
  'SELECT "is_super_admin already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
