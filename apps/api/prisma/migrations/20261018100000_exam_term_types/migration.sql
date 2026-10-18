-- Dynamic exam term types: user-defined names mapped to the 3 engine behaviors.
-- `exam_terms.termType` stores the master `code`; the engine resolves the code
-- to `engine_behavior` at runtime, so custom types (HALF_YEARLY, FINAL, ...)
-- behave exactly like their TERMINAL / SUB_EXAM_CT / CUMULATIVE_ANNUAL parent.

CREATE TABLE IF NOT EXISTS `exam_term_types` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `engine_behavior` VARCHAR(30) NOT NULL DEFAULT 'TERMINAL',
  `description` VARCHAR(255) NULL,
  `display_order` INT NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_exam_term_types_code`(`code`),
  INDEX `IDX_EXAM_TERM_TYPES_ACTIVE`(`is_active`),
  INDEX `IDX_EXAM_TERM_TYPES_BEHAVIOR`(`engine_behavior`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed the 3 engine behaviors + the most common Bangladeshi exam names.
-- Idempotent: re-running skips existing codes.
INSERT INTO `exam_term_types` (`id`, `name`, `code`, `engine_behavior`, `description`, `display_order`, `is_active`)
SELECT (uuid()), name, code, behavior, descr, ord, 1 FROM (
  SELECT 'Class Test / Incourse' AS name, 'SUB_EXAM_CT' AS code, 'SUB_EXAM_CT' AS behavior, 'Child sub-exam aggregated into its parent terminal (CC-06)' AS descr, 1 AS ord UNION ALL
  SELECT 'Terminal Exam', 'TERMINAL', 'TERMINAL', 'Main exam term — generates marksheets directly', 2 UNION ALL
  SELECT 'Annual (Cumulative)', 'CUMULATIVE_ANNUAL', 'CUMULATIVE_ANNUAL', 'Weighted aggregate of terminal children (CC-11 / AD-7)', 3 UNION ALL
  SELECT 'Half-Yearly', 'HALF_YEARLY', 'TERMINAL', 'Mid-year terminal exam', 4 UNION ALL
  SELECT 'Yearly Final', 'YEARLY_FINAL', 'TERMINAL', 'Year-end terminal exam', 5 UNION ALL
  SELECT 'Model Test', 'MODEL_TEST', 'TERMINAL', 'Pre-board model test (terminal behavior)', 6 UNION ALL
  SELECT 'Monthly Class Test', 'MONTHLY_CT', 'SUB_EXAM_CT', 'Monthly CT aggregated into the terminal', 7
) seed
WHERE NOT EXISTS (SELECT 1 FROM `exam_term_types` t WHERE t.`code` = seed.`code`);
