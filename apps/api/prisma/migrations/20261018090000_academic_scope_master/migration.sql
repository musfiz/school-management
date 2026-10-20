-- Academic scope master data: sessions + classes/departments.
-- These ids were previously opaque UUIDs typed by hand; the tables give them a
-- real entry screen while every consumer keeps passing the same UUID strings.

CREATE TABLE IF NOT EXISTS `academic_sessions` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `session_name` VARCHAR(50) NOT NULL,
  `session_code` VARCHAR(20) NOT NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_current` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_academic_sessions_code`(`session_code`),
  INDEX `IDX_ACADEMIC_SESSIONS_ACTIVE`(`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `class_or_depts` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `level` VARCHAR(20) NOT NULL DEFAULT 'SCHOOL',
  `display_order` INT NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_class_or_depts_code`(`code`),
  INDEX `IDX_CLASS_OR_DEPTS_ACTIVE`(`is_active`),
  INDEX `IDX_CLASS_OR_DEPTS_LEVEL`(`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
