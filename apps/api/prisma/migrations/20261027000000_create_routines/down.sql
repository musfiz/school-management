-- DropForeignKey
ALTER TABLE `routines` DROP FOREIGN KEY `FK_routines_academic_session`;
ALTER TABLE `routines` DROP FOREIGN KEY `FK_routines_class_or_dept`;
ALTER TABLE `routines` DROP FOREIGN KEY `FK_routines_academic_group`;

-- DropTable
DROP TABLE `routines`;
