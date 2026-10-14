import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAccountingCoreTables20261014000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'funds',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'fund_code', type: 'varchar', length: '10', isNullable: false, isUnique: true },
          { name: 'fund_name', type: 'varchar', length: '100', isNullable: false },
          { name: 'is_restricted', type: 'boolean', default: false },
          { name: 'shariah_compliant', type: 'boolean', default: false },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'cost_centers',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'center_code', type: 'varchar', length: '15', isNullable: false, isUnique: true },
          { name: 'center_name', type: 'varchar', length: '100', isNullable: false },
          { name: 'institution_type', type: 'varchar', length: '20', default: "'SCHOOL'" },
          { name: 'parent_id', type: 'int', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'cost_centers',
      new TableForeignKey({
        name: 'FK_cost_centers_parent',
        columnNames: ['parent_id'],
        referencedTableName: 'cost_centers',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'chart_of_accounts',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'gl_code', type: 'varchar', length: '20', isNullable: false, isUnique: true },
          { name: 'account_name', type: 'varchar', length: '150', isNullable: false },
          { name: 'account_name_bn', type: 'varchar', length: '150', isNullable: true },
          { name: 'account_type', type: 'varchar', length: '20', isNullable: false },
          { name: 'normal_balance', type: 'char', length: '2', isNullable: false },
          { name: 'parent_id', type: 'int', isNullable: true },
          { name: 'is_control_account', type: 'boolean', default: false },
          { name: 'is_cash_or_bank', type: 'boolean', default: false },
          { name: 'default_fund_id', type: 'int', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'chart_of_accounts',
      new TableForeignKey({
        name: 'FK_coa_parent',
        columnNames: ['parent_id'],
        referencedTableName: 'chart_of_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'chart_of_accounts',
      new TableForeignKey({
        name: 'FK_coa_default_fund',
        columnNames: ['default_fund_id'],
        referencedTableName: 'funds',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'fiscal_periods',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'period_name', type: 'varchar', length: '50', isNullable: false },
          { name: 'start_date', type: 'date', isNullable: false },
          { name: 'end_date', type: 'date', isNullable: false },
          { name: 'is_closed', type: 'boolean', default: false },
          { name: 'closed_by_user_id', type: 'int', isNullable: true },
          { name: 'closed_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fiscal_periods');
    await queryRunner.dropTable('chart_of_accounts');
    await queryRunner.dropTable('cost_centers');
    await queryRunner.dropTable('funds');
  }
}
