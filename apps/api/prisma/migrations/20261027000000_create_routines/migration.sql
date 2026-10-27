-- Drops a half-created table left behind by a previously failed run of this
-- migration (the CREATE succeeded, an ALTER ... ADD FOREIGN KEY failed).
DROP TABLE IF EXISTS `routines`;

-- CreateTable
CREATE TABLE `routines` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `title` VARCHAR(255) NOT NULL,
    `title_bn` VARCHAR(255) NULL,
    `academic_session_id` CHAR(36) NOT NULL,
    `class_or_dept_id` CHAR(36) NOT NULL,
    `academic_group_id` CHAR(36) NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'CLASS',
    `pdf_url` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX `IDX_routines_academic_session`(`academic_session_id`),
    INDEX `IDX_routines_class_or_dept`(`class_or_dept_id`),
    INDEX `IDX_routines_academic_group`(`academic_group_id`),
    INDEX `IDX_routines_is_active`(`is_active`),
    INDEX `IDX_routines_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- AddForeignKey
-- Collation must match the referenced primary keys exactly; the master tables
-- are normalized to utf8mb4_general_ci by 20261026120000.
ALTER TABLE `routines` ADD CONSTRAINT `FK_routines_academic_session` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routines` ADD CONSTRAINT `FK_routines_class_or_dept` FOREIGN KEY (`class_or_dept_id`) REFERENCES `class_or_depts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routines` ADD CONSTRAINT `FK_routines_academic_group` FOREIGN KEY (`academic_group_id`) REFERENCES `academic_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;