import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Phase 6 — payroll, MPO split, adjunct honorarium & PF
 * (plan Phase 6, spec §1.4).
 * - `payroll_runs`: PR-YYYY-MM-### monthly runs; MPO govt total stored
 *   for display only (never posted — see PayrollAccountingService).
 * - `payslip_lines`: one row per employee per run (CASCADE on run void).
 * - `adjunct_honorarium_bills`: AH-YYYY-XXXXXX workload bills with
 *   10–15% TDS (Dr 51103 / Cr 21103 + 21303).
 * Money = DECIMAL(15,2) (rates DECIMAL(5,2)); keys = CHAR(36) UUID.
 */
export class CreatePayrollTables20261020100000 implements MigrationInterface {
  name = 'CreatePayrollTables20261020100000';

  private uuidPk(name = 'id'): any {
    return { name, type: 'char', length: '36', isPrimary: true, default: '(UUID())' };
  }

  private uuidFk(name: string, nullable = true): any {
    return { name, type: 'char', length: '36', isNullable: nullable };
  }

  private money(name: string): any {
    return {
      name,
      type: 'decimal',
      precision: 15,
      scale: 2,
      default: "'0.00'",
      isNullable: false,
    };
  }

  private stamps(): any[] {
    return [
      { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      {
        name: 'updated_at',
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
      },
    ];
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payroll_runs',
        columns: [
          this.uuidPk(),
          { name: 'run_no', type: 'varchar', length: '30', isUnique: true },
          { name: 'payroll_month', type: 'varchar', length: '7' },
          { name: 'pay_date', type: 'date' },
          this.uuidFk('fund_id', false),
          this.uuidFk('cost_center_id'),
          this.money('mpo_govt_total'),
          this.money('institutional_gross_total'),
          this.money('pf_employee_total'),
          this.money('pf_employer_total'),
          this.money('ait_tds_total'),
          this.money('loan_deduction_total'),
          this.money('net_payable_total'),
          { name: 'status', type: 'varchar', length: '20', default: "'DRAFT'" },
          this.uuidFk('gl_journal_id'),
          this.uuidFk('payment_journal_id'),
          { name: 'narration', type: 'varchar', length: '255', isNullable: true },
          this.uuidFk('created_by_user_id'),
          ...this.stamps(),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'payroll_runs',
      new TableIndex({ name: 'IDX_PAYROLL_MONTH', columnNames: ['payroll_month'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'payslip_lines',
        columns: [
          this.uuidPk(),
          this.uuidFk('run_id', false),
          this.uuidFk('employee_id'),
          { name: 'employee_name', type: 'varchar', length: '150' },
          { name: 'designation', type: 'varchar', length: '120', isNullable: true },
          this.money('mpo_govt_amount'),
          this.money('institutional_gross_amount'),
          this.money('pf_employee_deduction'),
          this.money('pf_employer_contribution'),
          this.money('ait_tds_deduction'),
          this.money('loan_deduction'),
          this.money('net_institutional_payable'),
          ...this.stamps(),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'payslip_lines',
      new TableIndex({ name: 'IDX_PAYSLIP_RUN', columnNames: ['run_id'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'adjunct_honorarium_bills',
        columns: [
          this.uuidPk(),
          { name: 'bill_no', type: 'varchar', length: '30', isUnique: true },
          { name: 'adjunct_name', type: 'varchar', length: '150' },
          this.uuidFk('adjunct_id'),
          { name: 'work_month', type: 'varchar', length: '7' },
          { name: 'classes_count', type: 'int', default: 0 },
          { name: 'scripts_count', type: 'int', default: 0 },
          { name: 'viva_count', type: 'int', default: 0 },
          this.money('rate_per_class'),
          this.money('rate_per_script'),
          this.money('rate_per_viva'),
          this.money('gross_amount'),
          { name: 'tds_rate', type: 'decimal', precision: 5, scale: 2 },
          this.money('tds_amount'),
          this.money('net_payable'),
          this.uuidFk('fund_id', false),
          this.uuidFk('cost_center_id'),
          { name: 'status', type: 'varchar', length: '20', default: "'DRAFT'" },
          this.uuidFk('gl_journal_id'),
          { name: 'narration', type: 'varchar', length: '255', isNullable: true },
          this.uuidFk('created_by_user_id'),
          ...this.stamps(),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'adjunct_honorarium_bills',
      new TableIndex({ name: 'IDX_HONORARIUM_MONTH', columnNames: ['work_month'] }),
    );

    const fk = (
      table: string,
      column: string,
      ref: string,
      onDelete: 'RESTRICT' | 'CASCADE' | 'SET NULL' = 'RESTRICT',
    ) =>
      queryRunner.createForeignKey(
        table,
        new TableForeignKey({
          columnNames: [column],
          referencedTableName: ref,
          referencedColumnNames: ['id'],
          onDelete,
        }),
      );
    await fk('payroll_runs', 'fund_id', 'funds');
    await fk('payroll_runs', 'cost_center_id', 'cost_centers');
    await fk('payroll_runs', 'gl_journal_id', 'journal_entries');
    await fk('payroll_runs', 'payment_journal_id', 'journal_entries');
    await fk('payroll_runs', 'created_by_user_id', 'users', 'SET NULL');
    await fk('payslip_lines', 'run_id', 'payroll_runs', 'CASCADE');
    await fk('adjunct_honorarium_bills', 'fund_id', 'funds');
    await fk('adjunct_honorarium_bills', 'cost_center_id', 'cost_centers');
    await fk('adjunct_honorarium_bills', 'gl_journal_id', 'journal_entries');
    await fk('adjunct_honorarium_bills', 'created_by_user_id', 'users', 'SET NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payslip_lines');
    await queryRunner.dropTable('adjunct_honorarium_bills');
    await queryRunner.dropTable('payroll_runs');
  }
}
