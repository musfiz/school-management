import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Phase 3 — student billing & invoices (spec §1.2–1.3, plan Phase 3).
 * - `fee_heads`: revenue-GL-mapped fee catalogue (caution heads → 21401/21402).
 * - `student_waivers`: gross→net waiver grants (contra 41901–41904).
 * - `student_invoices` + `student_invoice_lines`: accrual invoices with
 *   unique (student_id, billing_period) anti-duplicate guard.
 * - `student_caution_deposits`: refundable deposit ledger (21401/21402).
 * Money = DECIMAL(15,2); keys = CHAR(36) UUID (MySQL→PG portable).
 */
export class CreateBillingTables20261017100000 implements MigrationInterface {
  name = 'CreateBillingTables20261017100000';

  private uuidPk(name = 'id'): any {
    return { name, type: 'char', length: '36', isPrimary: true, default: '(UUID())' };
  }

  private uuidFk(name: string, nullable = true): any {
    return { name, type: 'char', length: '36', isNullable: nullable };
  }

  private money(name: string, nullable = false): any {
    const col: any = {
      name,
      type: 'decimal',
      precision: 15,
      scale: 2,
      default: nullable ? undefined : "'0.00'",
      isNullable: nullable,
    };
    return col;
  }

  private timestamps(): any[] {
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
    /* ---------------- fee_heads ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'fee_heads',
        columns: [
          this.uuidPk(),
          { name: 'head_code', type: 'varchar', length: '30', isUnique: true },
          { name: 'head_name', type: 'varchar', length: '150' },
          { name: 'billing_type', type: 'varchar', length: '20', default: "'MONTHLY'" },
          this.money('default_amount'),
          this.money('per_credit_rate'),
          this.uuidFk('revenue_gl_id', false),
          this.uuidFk('fund_id'),
          this.uuidFk('cost_center_id'),
          { name: 'is_caution_deposit', type: 'boolean', default: false },
          { name: 'is_active', type: 'boolean', default: true },
          ...this.timestamps(),
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'fee_heads',
      new TableForeignKey({
        columnNames: ['revenue_gl_id'],
        referencedTableName: 'chart_of_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'fee_heads',
      new TableForeignKey({
        columnNames: ['fund_id'],
        referencedTableName: 'funds',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'fee_heads',
      new TableForeignKey({
        columnNames: ['cost_center_id'],
        referencedTableName: 'cost_centers',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    /* ---------------- student_waivers ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'student_waivers',
        columns: [
          this.uuidPk(),
          this.uuidFk('student_id', false),
          { name: 'waiver_type', type: 'varchar', length: '30' },
          { name: 'percent', type: 'decimal', precision: 5, scale: 2, default: "'0.00'" },
          { name: 'fixed_cap_amount', type: 'decimal', precision: 15, scale: 2, isNullable: true },
          this.uuidFk('contra_gl_id'),
          this.uuidFk('fund_id'),
          { name: 'active_from', type: 'date', isNullable: true },
          { name: 'active_to', type: 'date', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'remark', type: 'varchar', length: '255', isNullable: true },
          ...this.timestamps(),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'student_waivers',
      new TableIndex({ name: 'IDX_WAIVERS_STUDENT', columnNames: ['student_id'] }),
    );
    await queryRunner.createForeignKey(
      'student_waivers',
      new TableForeignKey({
        columnNames: ['contra_gl_id'],
        referencedTableName: 'chart_of_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'student_waivers',
      new TableForeignKey({
        columnNames: ['fund_id'],
        referencedTableName: 'funds',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    /* ---------------- student_invoices ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'student_invoices',
        columns: [
          this.uuidPk(),
          { name: 'invoice_no', type: 'varchar', length: '30', isUnique: true },
          this.uuidFk('student_id', false),
          { name: 'billing_period', type: 'varchar', length: '30' },
          { name: 'issue_date', type: 'date' },
          { name: 'due_date', type: 'date' },
          { name: 'status', type: 'varchar', length: '20', default: "'UNPAID'" },
          this.money('gross_amount'),
          this.money('waiver_amount'),
          this.money('net_amount'),
          this.money('paid_amount'),
          this.money('late_fine_amount'),
          this.uuidFk('fiscal_period_id', false),
          this.uuidFk('journal_entry_id'),
          this.uuidFk('cost_center_id'),
          this.uuidFk('created_by_user_id'),
          { name: 'narration', type: 'varchar', length: '255', isNullable: true },
          ...this.timestamps(),
        ],
        uniques: [
          { name: 'uq_invoice_student_period', columnNames: ['student_id', 'billing_period'] },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'student_invoices',
      new TableIndex({ name: 'IDX_INVOICES_STUDENT', columnNames: ['student_id'] }),
    );
    await queryRunner.createIndex(
      'student_invoices',
      new TableIndex({ name: 'IDX_INVOICES_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'student_invoices',
      new TableIndex({ name: 'IDX_INVOICES_DUE', columnNames: ['due_date'] }),
    );
    await queryRunner.createForeignKey(
      'student_invoices',
      new TableForeignKey({
        columnNames: ['fiscal_period_id'],
        referencedTableName: 'fiscal_periods',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'student_invoices',
      new TableForeignKey({
        columnNames: ['journal_entry_id'],
        referencedTableName: 'journal_entries',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'student_invoices',
      new TableForeignKey({
        columnNames: ['cost_center_id'],
        referencedTableName: 'cost_centers',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    /* ---------------- student_invoice_lines ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'student_invoice_lines',
        columns: [
          this.uuidPk(),
          this.uuidFk('invoice_id', false),
          this.uuidFk('fee_head_id', false),
          this.uuidFk('gl_account_id', false),
          this.uuidFk('fund_id', false),
          this.uuidFk('cost_center_id'),
          { name: 'credit_hours', type: 'decimal', precision: 8, scale: 2, default: "'0.00'" },
          this.money('gross_amount'),
          this.money('waiver_amount'),
          this.money('net_amount'),
          this.uuidFk('waiver_id'),
          { name: 'line_memo', type: 'varchar', length: '255', isNullable: true },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'student_invoice_lines',
      new TableIndex({ name: 'IDX_INV_LINES_INVOICE', columnNames: ['invoice_id'] }),
    );
    await queryRunner.createForeignKey(
      'student_invoice_lines',
      new TableForeignKey({
        columnNames: ['invoice_id'],
        referencedTableName: 'student_invoices',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'student_invoice_lines',
      new TableForeignKey({
        columnNames: ['fee_head_id'],
        referencedTableName: 'fee_heads',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'student_invoice_lines',
      new TableForeignKey({
        columnNames: ['gl_account_id'],
        referencedTableName: 'chart_of_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'student_invoice_lines',
      new TableForeignKey({
        columnNames: ['fund_id'],
        referencedTableName: 'funds',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'student_invoice_lines',
      new TableForeignKey({
        columnNames: ['cost_center_id'],
        referencedTableName: 'cost_centers',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'student_invoice_lines',
      new TableForeignKey({
        columnNames: ['waiver_id'],
        referencedTableName: 'student_waivers',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    /* ---------------- student_caution_deposits ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'student_caution_deposits',
        columns: [
          this.uuidPk(),
          this.uuidFk('student_id', false),
          this.uuidFk('gl_account_id', false),
          this.money('amount'),
          { name: 'status', type: 'varchar', length: '20', default: "'HELD'" },
          this.uuidFk('receipt_journal_id'),
          this.uuidFk('settlement_journal_id'),
          { name: 'remark', type: 'varchar', length: '255', isNullable: true },
          ...this.timestamps(),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'student_caution_deposits',
      new TableIndex({ name: 'IDX_CAUTION_STUDENT', columnNames: ['student_id'] }),
    );
    await queryRunner.createForeignKey(
      'student_caution_deposits',
      new TableForeignKey({
        columnNames: ['gl_account_id'],
        referencedTableName: 'chart_of_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('student_caution_deposits');
    await queryRunner.dropTable('student_invoice_lines');
    await queryRunner.dropTable('student_invoices');
    await queryRunner.dropTable('student_waivers');
    await queryRunner.dropTable('fee_heads');
  }
}
