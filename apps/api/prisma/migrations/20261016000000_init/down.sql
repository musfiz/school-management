-- down.sql — rollback for 20261016000000_init
-- Reverses migration.sql. Generated with prisma migrate diff between the
-- migration states before/after this migration — do NOT hand-edit.
-- Applied by: npm run db:rollback
-- DropForeignKey
ALTER TABLE `accounting_audit_logs` DROP FOREIGN KEY `FK_5cc7ad3d4322ee077af303a416c`;

-- DropForeignKey
ALTER TABLE `adjunct_honorarium_bills` DROP FOREIGN KEY `FK_4f289bec631bfba5cd9c4049b2e`;

-- DropForeignKey
ALTER TABLE `adjunct_honorarium_bills` DROP FOREIGN KEY `FK_7f39a395e294512630a28f76aef`;

-- DropForeignKey
ALTER TABLE `adjunct_honorarium_bills` DROP FOREIGN KEY `FK_ce9decd83d40698cd87796eb5ae`;

-- DropForeignKey
ALTER TABLE `adjunct_honorarium_bills` DROP FOREIGN KEY `FK_f4a75afd9e3f9a1b79e3da340e3`;

-- DropForeignKey
ALTER TABLE `admission_applications` DROP FOREIGN KEY `FK_4c7f324b23124b4609841a16cae`;

-- DropForeignKey
ALTER TABLE `admission_applications` DROP FOREIGN KEY `FK_ebba2cd78268c80e1d1b4f6d959`;

-- DropForeignKey
ALTER TABLE `chart_of_accounts` DROP FOREIGN KEY `FK_coa_default_fund`;

-- DropForeignKey
ALTER TABLE `chart_of_accounts` DROP FOREIGN KEY `FK_coa_parent`;

-- DropForeignKey
ALTER TABLE `class_syllabus_subjects` DROP FOREIGN KEY `FK_6db9c01b5b77757cb51ec8963dd`;

-- DropForeignKey
ALTER TABLE `cost_centers` DROP FOREIGN KEY `FK_cost_centers_parent`;

-- DropForeignKey
ALTER TABLE `fee_heads` DROP FOREIGN KEY `FK_45728218dd0533dafc4098d578f`;

-- DropForeignKey
ALTER TABLE `fee_heads` DROP FOREIGN KEY `FK_75669e4129d2d9b6c0765641287`;

-- DropForeignKey
ALTER TABLE `fee_heads` DROP FOREIGN KEY `FK_a174486d2c8d482b9116f633548`;

-- DropForeignKey
ALTER TABLE `journal_entries` DROP FOREIGN KEY `FK_0cd1b7a9f4a2dbb2006af7527bd`;

-- DropForeignKey
ALTER TABLE `journal_entries` DROP FOREIGN KEY `FK_1845d906faef6586c6d1ac639a9`;

-- DropForeignKey
ALTER TABLE `journal_entries` DROP FOREIGN KEY `FK_77fe13fb6db6b1fea4ff4d70cd2`;

-- DropForeignKey
ALTER TABLE `journal_entries` DROP FOREIGN KEY `FK_dfb001500889ba5445dcebedf7e`;

-- DropForeignKey
ALTER TABLE `journal_entries` DROP FOREIGN KEY `FK_e9a1725d8c4972d7d672a7d5ecd`;

-- DropForeignKey
ALTER TABLE `journal_lines` DROP FOREIGN KEY `FK_1fd23ae91f0c24764b4e581c72e`;

-- DropForeignKey
ALTER TABLE `journal_lines` DROP FOREIGN KEY `FK_29bf92dbf024d23a9bebeea8cf5`;

-- DropForeignKey
ALTER TABLE `journal_lines` DROP FOREIGN KEY `FK_7002186b79482768d2a8048aca7`;

-- DropForeignKey
ALTER TABLE `journal_lines` DROP FOREIGN KEY `FK_a250afb08d8ae2e62629c60e100`;

-- DropForeignKey
ALTER TABLE `menu_items` DROP FOREIGN KEY `FK_MENU_ITEMS_PARENT`;

-- DropForeignKey
ALTER TABLE `payment_collections` DROP FOREIGN KEY `FK_2f480bd26e010da3f88fdb5ca89`;

-- DropForeignKey
ALTER TABLE `payment_collections` DROP FOREIGN KEY `FK_553921c63cd12349c268f20d478`;

-- DropForeignKey
ALTER TABLE `payment_collections` DROP FOREIGN KEY `FK_a2ea2f79498def55cbe883c97a0`;

-- DropForeignKey
ALTER TABLE `payment_collections` DROP FOREIGN KEY `FK_b149022fe7461319e295a983900`;

-- DropForeignKey
ALTER TABLE `payroll_runs` DROP FOREIGN KEY `FK_2784638bcb4961f09de25ceb871`;

-- DropForeignKey
ALTER TABLE `payroll_runs` DROP FOREIGN KEY `FK_6c1c3e51a85243dc4e7b981e2b9`;

-- DropForeignKey
ALTER TABLE `payroll_runs` DROP FOREIGN KEY `FK_c79243d7310cc718d3d7207b64e`;

-- DropForeignKey
ALTER TABLE `payroll_runs` DROP FOREIGN KEY `FK_d55de221adb3b66278c1f66681a`;

-- DropForeignKey
ALTER TABLE `payroll_runs` DROP FOREIGN KEY `FK_e7fda897ba99ea795bf9a22b4e7`;

-- DropForeignKey
ALTER TABLE `payslip_lines` DROP FOREIGN KEY `FK_dc4ee2b2653728dd07f13455c9c`;

-- DropForeignKey
ALTER TABLE `permissions` DROP FOREIGN KEY `FK_738f46bb9ac6ea356f1915835d0`;

-- DropForeignKey
ALTER TABLE `student_caution_deposits` DROP FOREIGN KEY `FK_fc4ae3d9ab90adc7384becbe386`;

-- DropForeignKey
ALTER TABLE `student_documents` DROP FOREIGN KEY `FK_8b0e086cbeca4ba69aadaac8541`;

-- DropForeignKey
ALTER TABLE `student_documents` DROP FOREIGN KEY `FK_9a1617311db9e7e586ab9bc05a9`;

-- DropForeignKey
ALTER TABLE `student_enrollments` DROP FOREIGN KEY `FK_08caafd8a026a19ecf54db0e958`;

-- DropForeignKey
ALTER TABLE `student_invoice_lines` DROP FOREIGN KEY `FK_035bf01694d659913f736a76672`;

-- DropForeignKey
ALTER TABLE `student_invoice_lines` DROP FOREIGN KEY `FK_1e499a36b5cd17128be10d3b415`;

-- DropForeignKey
ALTER TABLE `student_invoice_lines` DROP FOREIGN KEY `FK_9db5abe778ddab94285c1bdeed8`;

-- DropForeignKey
ALTER TABLE `student_invoice_lines` DROP FOREIGN KEY `FK_ab278aa704f6813f6a0f288e3d4`;

-- DropForeignKey
ALTER TABLE `student_invoice_lines` DROP FOREIGN KEY `FK_b795c15fd3b45859b6213f3a3ec`;

-- DropForeignKey
ALTER TABLE `student_invoice_lines` DROP FOREIGN KEY `FK_eb0be5e84e5b6c82e99d32db523`;

-- DropForeignKey
ALTER TABLE `student_invoices` DROP FOREIGN KEY `FK_528c0905688b9272b12a69c35ed`;

-- DropForeignKey
ALTER TABLE `student_invoices` DROP FOREIGN KEY `FK_65542b0944b005443bdbf4756f3`;

-- DropForeignKey
ALTER TABLE `student_invoices` DROP FOREIGN KEY `FK_f918f7c39bab56ef2a8850bb81d`;

-- DropForeignKey
ALTER TABLE `student_previous_educations` DROP FOREIGN KEY `FK_cd587085933a1a022c90c31d545`;

-- DropForeignKey
ALTER TABLE `student_subject_enrollments` DROP FOREIGN KEY `FK_d9ddcc2f7e4b87d9813f9f3e193`;

-- DropForeignKey
ALTER TABLE `student_waivers` DROP FOREIGN KEY `FK_94f15acf285950c2d0b85c54567`;

-- DropForeignKey
ALTER TABLE `student_waivers` DROP FOREIGN KEY `FK_d322e215cde77b75f60af410074`;

-- DropForeignKey
ALTER TABLE `students` DROP FOREIGN KEY `FK_d0964695550b73c47dcc55b6f80`;

-- DropForeignKey
ALTER TABLE `tax_challan_items` DROP FOREIGN KEY `FK_147d7f26963dabed76013224c11`;

-- DropForeignKey
ALTER TABLE `tax_challan_items` DROP FOREIGN KEY `FK_318ca8a2147e43329eec9c0a65a`;

-- DropForeignKey
ALTER TABLE `tax_challans` DROP FOREIGN KEY `FK_8873912ce8258c482d44409d534`;

-- DropForeignKey
ALTER TABLE `tax_challans` DROP FOREIGN KEY `FK_d193b9ac044bd03087c2e49317d`;

-- DropForeignKey
ALTER TABLE `tax_challans` DROP FOREIGN KEY `FK_f9131bf1f77c9cf6496338e7879`;

-- DropForeignKey
ALTER TABLE `user_permissions` DROP FOREIGN KEY `FK_3495bd31f1862d02931e8e8d2e8`;

-- DropForeignKey
ALTER TABLE `user_permissions` DROP FOREIGN KEY `FK_5dd800c5e91aa3997060508bf2e`;

-- DropForeignKey
ALTER TABLE `user_permissions` DROP FOREIGN KEY `FK_8145f5fadacd311693c15e41f10`;

-- DropForeignKey
ALTER TABLE `vendor_bills` DROP FOREIGN KEY `FK_0182d1c44fa5b860a14d0fcda06`;

-- DropForeignKey
ALTER TABLE `vendor_bills` DROP FOREIGN KEY `FK_28d037073acb7c50b4dbae9736e`;

-- DropForeignKey
ALTER TABLE `vendor_bills` DROP FOREIGN KEY `FK_61e9c923e0ead2d238400684c43`;

-- DropForeignKey
ALTER TABLE `vendor_bills` DROP FOREIGN KEY `FK_6f4bf16a8536ae1bdf7f8ad6ed4`;

-- DropForeignKey
ALTER TABLE `vendor_bills` DROP FOREIGN KEY `FK_8559aeb8b449295787d733cd4be`;

-- DropForeignKey
ALTER TABLE `vendor_bills` DROP FOREIGN KEY `FK_a577d0f1830fcf3c84556ec5b35`;

-- DropTable
DROP TABLE `academic_subjects`;

-- DropTable
DROP TABLE `accounting_audit_logs`;

-- DropTable
DROP TABLE `adjunct_honorarium_bills`;

-- DropTable
DROP TABLE `admission_applications`;

-- DropTable
DROP TABLE `admission_campaigns`;

-- DropTable
DROP TABLE `admission_sequences`;

-- DropTable
DROP TABLE `chart_of_accounts`;

-- DropTable
DROP TABLE `class_syllabus_subjects`;

-- DropTable
DROP TABLE `cost_centers`;

-- DropTable
DROP TABLE `ex_principals`;

-- DropTable
DROP TABLE `family_profiles`;

-- DropTable
DROP TABLE `fee_heads`;

-- DropTable
DROP TABLE `fiscal_periods`;

-- DropTable
DROP TABLE `funds`;

-- DropTable
DROP TABLE `governing_body_members`;

-- DropTable
DROP TABLE `hero_sections`;

-- DropTable
DROP TABLE `journal_entries`;

-- DropTable
DROP TABLE `journal_lines`;

-- DropTable
DROP TABLE `menu_items`;

-- DropTable
DROP TABLE `migrations`;

-- DropTable
DROP TABLE `modules`;

-- DropTable
DROP TABLE `notices`;

-- DropTable
DROP TABLE `pages`;

-- DropTable
DROP TABLE `payment_collections`;

-- DropTable
DROP TABLE `payroll_runs`;

-- DropTable
DROP TABLE `payslip_lines`;

-- DropTable
DROP TABLE `permissions`;

-- DropTable
DROP TABLE `required_document_rules`;

-- DropTable
DROP TABLE `site_settings`;

-- DropTable
DROP TABLE `sliders`;

-- DropTable
DROP TABLE `staff_members`;

-- DropTable
DROP TABLE `student_caution_deposits`;

-- DropTable
DROP TABLE `student_documents`;

-- DropTable
DROP TABLE `student_enrollments`;

-- DropTable
DROP TABLE `student_invoice_lines`;

-- DropTable
DROP TABLE `student_invoices`;

-- DropTable
DROP TABLE `student_previous_educations`;

-- DropTable
DROP TABLE `student_subject_enrollments`;

-- DropTable
DROP TABLE `student_waivers`;

-- DropTable
DROP TABLE `students`;

-- DropTable
DROP TABLE `tax_challan_items`;

-- DropTable
DROP TABLE `tax_challans`;

-- DropTable
DROP TABLE `teachers`;

-- DropTable
DROP TABLE `user_permissions`;

-- DropTable
DROP TABLE `users`;

-- DropTable
DROP TABLE `vendor_bills`;

-- DropTable
DROP TABLE `vendors`;

-- DropTable
DROP TABLE `voucher_sequences`;

-- DropTable
DROP TABLE `waiver_preset_rules`;

