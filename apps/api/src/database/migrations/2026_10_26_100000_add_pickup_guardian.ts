import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 — kindergarten pickup-guardian fields on `students`
 * (Admission Plan Step 2: KG mode shows pick-up guardian).
 */
export class AddPickupGuardian20261026100000 implements MigrationInterface {
  name = 'AddPickupGuardian20261026100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE students ADD COLUMN pickup_guardian_name VARCHAR(120) NULL`);
    await queryRunner.query(`ALTER TABLE students ADD COLUMN pickup_guardian_phone VARCHAR(20) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE students DROP COLUMN pickup_guardian_phone`);
    await queryRunner.query(`ALTER TABLE students DROP COLUMN pickup_guardian_name`);
  }
}
