-- CreateTable
CREATE TABLE `galleries` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `image_url` VARCHAR(255) NOT NULL,
    `title_en` VARCHAR(200) NULL,
    `title_bn` VARCHAR(200) NULL,
    `subtitle_en` VARCHAR(255) NULL,
    `subtitle_bn` VARCHAR(255) NULL,
    `tag_en` VARCHAR(100) NULL,
    `tag_bn` VARCHAR(100) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX `IDX_galleries_is_active`(`is_active`),
    INDEX `IDX_galleries_tag_en`(`tag_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
