import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Phase 4 — fee collection receipts (plan Phase 4, spec §1.4).
 * - `payment_collections`: one row per money receipt (MR-YYYY-XXXXXX)
 *   against one invoice; gross credited to the ledger, TDR split out.
 * - `gateway_trx_id` UNIQUE enforces webhook idempotency (replay the
 *   same bKash callback twice → one receipt).
 * Money = DECIMAL(15,2); keys = CHAR(36) UUID (MySQL→PG portable).
 */
export class CreateCollectionTables20261018100000 implements MigrationInterface {
  name = 'CreateCollectionTables20261018100000';

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

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_collections',
        columns: [
          this.uuidPk(),
          { name: 'money_receipt_no', type: 'varchar', length: '30', isUnique: true },
          this.uuidFk('student_id', false),
          this.uuidFk('invoice_id', false),
          { name: 'payment_channel', type: 'varchar', length: '20' },
          { name: 'gateway_trx_id', type: 'varchar', length: '80', isNullable: true },
          this.money('collected_gross_amount'),
          this.money('gateway_tdr_fee'),
          this.money('net_bank_amount'),
          this.uuidFk('cash_gl_id', false),
          this.uuidFk('fund_id'),
          { name: 'reconciliation_status', type: 'varchar', length: '20', default: "'COLLECTED'" },
          this.uuidFk('gl_journal_id'),
          this.uuidFk('settlement_journal_id'),
          { name: 'bank_reference', type: 'varchar', length: '80', isNullable: true },
          { name: 'allocation', type: 'text', isNullable: true },
          this.uuidFk('collected_by_user_id'),
          { name: 'remark', type: 'varchar', length: '255', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [{ name: 'uq_collection_gateway_trx', columnNames: ['gateway_trx_id'] }],
      }),
      true,
    );
    await queryRunner.createIndex(
      'payment_collections',
      new TableIndex({ name: 'IDX_COLLECTION_STUDENT', columnNames: ['student_id'] }),
    );
    await queryRunner.createIndex(
      'payment_collections',
      new TableIndex({ name: 'IDX_COLLECTION_INVOICE', columnNames: ['invoice_id'] }),
    );
    await queryRunner.createIndex(
      'payment_collections',
      new TableIndex({ name: 'IDX_COLLECTION_STATUS', columnNames: ['reconciliation_status'] }),
    );
    await queryRunner.createForeignKey(
      'payment_collections',
      new TableForeignKey({
        columnNames: ['invoice_id'],
        referencedTableName: 'student_invoices',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'payment_collections',
      new TableForeignKey({
        columnNames: ['cash_gl_id'],
        referencedTableName: 'chart_of_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'payment_collections',
      new TableForeignKey({
        columnNames: ['fund_id'],
        referencedTableName: 'funds',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'payment_collections',
      new TableForeignKey({
        columnNames: ['gl_journal_id'],
        referencedTableName: 'journal_entries',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_collections');
  }
}
