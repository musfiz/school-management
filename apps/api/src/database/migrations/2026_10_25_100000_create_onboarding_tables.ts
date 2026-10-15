import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Workflow 4 — onboarding primitives (Admission Plan §4 Workflow 4, Phase 1).
 * - `admission_sequences`: row-locked counters for student IDs, family
 *   codes, application numbers and class rolls (no duplicates under
 *   concurrency).
 * - `student_waivers.scope_billing_types`: admission-time waivers apply
 *   only to scoped billing types (e.g. 'ONE_TIME,TERM' one-shot admission
 *   part vs 'MONTHLY' ongoing tuition part). NULL = legacy apply-everywhere.
 */
export class CreateOnboardingTables20261025100000 implements MigrationInterface {
  name = 'CreateOnboardingTables20261025100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admission_sequences',
        columns: [
          { name: 'scope_key', type: 'varchar', length: '80', isPrimary: true },
          { name: 'last_number', type: 'int', default: 0 },
        ],
      }),
      true,
    );
    await queryRunner.query(
      `ALTER TABLE student_waivers ADD COLUMN scope_billing_types VARCHAR(60) NULL`,
    );
    await queryRunner.createIndex(
      'student_waivers',
      new TableIndex({ name: 'IDX_WAIVERS_SCOPE', columnNames: ['scope_billing_types'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE student_waivers DROP COLUMN scope_billing_types`);
    await queryRunner.dropTable('admission_sequences', true);
  }
}
