import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Workflow 2 — `waiver_preset_rules`: GPA-band + quota + residence
 * → waiver suggestion config (docs/STUDENT_ADMISSION_PLAN.md §4).
 * Money-free (percents only); DECIMAL(4,2) GPA bands, DECIMAL(5,2) pcts.
 */
export class CreateWaiverPresetRules20261023100000 implements MigrationInterface {
  name = 'CreateWaiverPresetRules20261023100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'waiver_preset_rules',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true, default: '(UUID())' },
          { name: 'rule_code', type: 'varchar', length: '40', isUnique: true },
          { name: 'rule_name', type: 'varchar', length: '120' },
          { name: 'institution_type', type: 'varchar', length: '25', isNullable: true },
          { name: 'min_gpa', type: 'decimal', precision: 4, scale: 2, isNullable: true },
          { name: 'max_gpa', type: 'decimal', precision: 4, scale: 2, isNullable: true },
          { name: 'quota_tag', type: 'varchar', length: '40', isNullable: true },
          { name: 'residence_type', type: 'varchar', length: '25', isNullable: true },
          { name: 'waiver_type', type: 'varchar', length: '30' },
          { name: 'admission_fee_pct', type: 'decimal', precision: 5, scale: 2, default: "'0.00'" },
          { name: 'tuition_fee_pct', type: 'decimal', precision: 5, scale: 2, default: "'0.00'" },
          { name: 'requires_zakat_eligible', type: 'boolean', default: false },
          { name: 'priority', type: 'int', default: 100 },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'remark', type: 'varchar', length: '255', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'waiver_preset_rules',
      new TableIndex({ name: 'IDX_WAIVER_RULES_ACTIVE', columnNames: ['is_active', 'priority'] }),
    );
    await queryRunner.createIndex(
      'waiver_preset_rules',
      new TableIndex({ name: 'IDX_WAIVER_RULES_QUOTA', columnNames: ['quota_tag'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('waiver_preset_rules', true);
  }
}
