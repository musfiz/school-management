import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Phase 5 — procurement, vendor payables & NBR withholding
 * (plan Phase 5, spec §1.4).
 * - `vendors`: supplier / contractor master.
 * - `vendor_bills`: VB-YYYY-XXXXXX bills with TDS/VDS computed at entry,
 *   posted on approval (Dr 5xxxx/121xx / Cr 21101 + 21302 + 21304).
 * - `tax_challans` + `tax_challan_items`: Treasury deposits batching
 *   withheld legs (Dr 21302/21304 / Cr 11201).
 * Money = DECIMAL(15,2) (rates DECIMAL(5,2)); keys = CHAR(36) UUID.
 */
export class CreateProcurementTables20261019100000 implements MigrationInterface {
  name = 'CreateProcurementTables20261019100000';

  private uuidPk(name = 'id'): any {
    return { name, type: 'char', length: '36', isPrimary: true, default: '(UUID())' };
  }

  private uuidFk(name: string, nullable = true): any {
    return { name, type: 'char', length: '36', isNullable: nullable };
  }

  private money(name: string, nullable = false): any {
    return {
      name,
      type: 'decimal',
      precision: 15,
      scale: 2,
      default: "'0.00'",
      isNullable: nullable,
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
        name: 'vendors',
        columns: [
          this.uuidPk(),
          { name: 'vendor_code', type: 'varchar', length: '20', isNullable: true, isUnique: true },
          { name: 'vendor_name', type: 'varchar', length: '150' },
          { name: 'bin_no', type: 'varchar', length: '20', isNullable: true },
          { name: 'trade_license_no', type: 'varchar', length: '60', isNullable: true },
          { name: 'contact_person', type: 'varchar', length: '120', isNullable: true },
          { name: 'contact_phone', type: 'varchar', length: '30', isNullable: true },
          { name: 'address', type: 'varchar', length: '255', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          ...this.stamps(),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'vendor_bills',
        columns: [
          this.uuidPk(),
          { name: 'bill_no', type: 'varchar', length: '30', isUnique: true },
          this.uuidFk('vendor_id', false),
          this.uuidFk('expense_gl_id', false),
          this.uuidFk('fund_id', false),
          this.uuidFk('cost_center_id'),
          { name: 'bill_date', type: 'date' },
          { name: 'due_date', type: 'date', isNullable: true },
          { name: 'supplier_invoice_no', type: 'varchar', length: '60', isNullable: true },
          this.money('gross_amount'),
          { name: 'tds_rate', type: 'decimal', precision: 5, scale: 2, default: "'0.00'" },
          this.money('tds_amount'),
          { name: 'vds_rate', type: 'decimal', precision: 5, scale: 2, default: "'0.00'" },
          this.money('vds_amount'),
          this.money('net_payable'),
          this.money('paid_amount'),
          this.money('tds_remitted_amount'),
          this.money('vds_remitted_amount'),
          { name: 'mushak_63_received', type: 'boolean', default: false },
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
      'vendor_bills',
      new TableIndex({ name: 'IDX_BILL_VENDOR', columnNames: ['vendor_id'] }),
    );
    await queryRunner.createIndex(
      'vendor_bills',
      new TableIndex({ name: 'IDX_BILL_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'vendor_bills',
      new TableIndex({ name: 'IDX_BILL_DATE', columnNames: ['bill_date'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'tax_challans',
        columns: [
          this.uuidPk(),
          { name: 'challan_no', type: 'varchar', length: '60', isUnique: true },
          { name: 'challan_date', type: 'date' },
          this.uuidFk('bank_gl_id', false),
          { name: 'deposit_bank_name', type: 'varchar', length: '120', isNullable: true },
          this.money('total_amount'),
          this.uuidFk('gl_journal_id'),
          { name: 'status', type: 'varchar', length: '20', default: "'POSTED'" },
          this.uuidFk('created_by_user_id'),
          ...this.stamps(),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'tax_challan_items',
        columns: [
          this.uuidPk(),
          this.uuidFk('challan_id', false),
          this.uuidFk('vendor_bill_id', false),
          { name: 'tax_type', type: 'varchar', length: '10' },
          this.money('amount'),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'tax_challan_items',
      new TableIndex({ name: 'IDX_CHALLAN_ITEM_CHALLAN', columnNames: ['challan_id'] }),
    );
    await queryRunner.createIndex(
      'tax_challan_items',
      new TableIndex({ name: 'IDX_CHALLAN_ITEM_BILL', columnNames: ['vendor_bill_id'] }),
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
    await fk('vendor_bills', 'vendor_id', 'vendors');
    await fk('vendor_bills', 'expense_gl_id', 'chart_of_accounts');
    await fk('vendor_bills', 'fund_id', 'funds');
    await fk('vendor_bills', 'cost_center_id', 'cost_centers');
    await fk('vendor_bills', 'gl_journal_id', 'journal_entries');
    await fk('vendor_bills', 'created_by_user_id', 'users', 'SET NULL');
    await fk('tax_challans', 'bank_gl_id', 'chart_of_accounts');
    await fk('tax_challans', 'gl_journal_id', 'journal_entries');
    await fk('tax_challans', 'created_by_user_id', 'users', 'SET NULL');
    await fk('tax_challan_items', 'challan_id', 'tax_challans', 'CASCADE');
    await fk('tax_challan_items', 'vendor_bill_id', 'vendor_bills');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tax_challan_items');
    await queryRunner.dropTable('tax_challans');
    await queryRunner.dropTable('vendor_bills');
    await queryRunner.dropTable('vendors');
  }
}
