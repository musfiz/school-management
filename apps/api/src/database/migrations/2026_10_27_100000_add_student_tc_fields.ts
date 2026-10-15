import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 — Transfer Certificate fields on `students`.
 * Records the TC number/date/remark when a student exits (status →
 * TC_ISSUED), giving the lifecycle action a durable audit trail without a
 * dedicated TC table.
 */
export class AddStudentTcFields20261027100000 implements MigrationInterface {
  name = 'AddStudentTcFields20261027100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE students ADD COLUMN tc_number VARCHAR(50) NULL`);
    await queryRunner.query(`ALTER TABLE students ADD COLUMN tc_issue_date DATE NULL`);
    await queryRunner.query(`ALTER TABLE students ADD COLUMN tc_remark VARCHAR(255) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE students DROP COLUMN tc_remark`);
    await queryRunner.query(`ALTER TABLE students DROP COLUMN tc_issue_date`);
    await queryRunner.query(`ALTER TABLE students DROP COLUMN tc_number`);
  }
}
