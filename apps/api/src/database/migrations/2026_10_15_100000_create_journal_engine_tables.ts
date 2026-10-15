import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Phase 2 — immutable double-entry journal engine (spec §3.2, plan Phase 2).
 *
 * - `journal_entries`: voucher header with Maker→Checker→Approver status.
 * - `journal_lines`: debit/credit legs in DECIMAL(15,2), fund + cost-center
 *   dimensions and optional control-account sub-ledger reference.
 * - `voucher_sequences`: last issued number per (year × type), locked
 *   `FOR UPDATE` by the posting service so numbers never collide.
 *
 * Run: `pnpm --filter api migration:run` (after the UUID baseline).
 */
export class CreateJournalEngineTables20261015100000 implements MigrationInterface {
  name = 'CreateJournalEngineTables20261015100000';

  private uuidPk(name = 'id'): any {
    return {
      name,
      type: 'char',
      length: '36',
      isPrimary: true,
      default: '(UUID())',
    };
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
    };
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ---------------- journal_entries ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'journal_entries',
        columns: [
          this.uuidPk(),
          { name: 'voucher_no', type: 'varchar', length: '30', isUnique: true },
          { name: 'voucher_type', type: 'varchar', length: 20 },
          { name: 'transaction_date', type: 'date' },
          this.uuidFk('fiscal_period_id', false),
          { name: 'source_module', type: 'varchar', length: 30, default: "'MANUAL'" },
          this.uuidFk('source_reference_id'),
          { name: 'narration', type: 'text' },
          { name: 'status', type: 'varchar', length: 20, default: "'DRAFT'" },
          this.uuidFk('reversed_entry_id'),
          this.uuidFk('created_by_user_id', false),
          this.uuidFk('verified_by_user_id'),
          this.uuidFk('approved_by_user_id'),
          { name: 'approved_at', type: 'timestamp', isNullable: true },
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
      'journal_entries',
      new TableIndex({ name: 'IDX_JOURNAL_VOUCHER_NO', columnNames: ['voucher_no'] }),
    );
    await queryRunner.createIndex(
      'journal_entries',
      new TableIndex({ name: 'IDX_JOURNAL_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'journal_entries',
      new TableIndex({ name: 'IDX_JOURNAL_TXN_DATE', columnNames: ['transaction_date'] }),
    );
    await queryRunner.createForeignKey(
      'journal_entries',
      new TableForeignKey({
        columnNames: ['fiscal_period_id'],
        referencedTableName: 'fiscal_periods',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'journal_entries',
      new TableForeignKey({
        columnNames: ['reversed_entry_id'],
        referencedTableName: 'journal_entries',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'journal_entries',
      new TableForeignKey({
        columnNames: ['created_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'journal_entries',
      new TableForeignKey({
        columnNames: ['verified_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'journal_entries',
      new TableForeignKey({
        columnNames: ['approved_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    /* ---------------- journal_lines ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'journal_lines',
        columns: [
          this.uuidPk(),
          this.uuidFk('journal_entry_id', false),
          this.uuidFk('gl_account_id', false),
          this.uuidFk('fund_id', false),
          this.uuidFk('cost_center_id'),
          { name: 'subledger_type', type: 'varchar', length: 30, isNullable: true },
          this.uuidFk('subledger_id'),
          this.money('debit_amount'),
          this.money('credit_amount'),
          { name: 'line_memo', type: 'varchar', length: 255, isNullable: true },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'journal_lines',
      new TableIndex({ name: 'IDX_JLINES_ENTRY', columnNames: ['journal_entry_id'] }),
    );
    await queryRunner.createIndex(
      'journal_lines',
      new TableIndex({ name: 'IDX_JLINES_GL', columnNames: ['gl_account_id'] }),
    );
    await queryRunner.createIndex(
      'journal_lines',
      new TableIndex({ name: 'IDX_JLINES_FUND', columnNames: ['fund_id'] }),
    );
    await queryRunner.createForeignKey(
      'journal_lines',
      new TableForeignKey({
        columnNames: ['journal_entry_id'],
        referencedTableName: 'journal_entries',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'journal_lines',
      new TableForeignKey({
        columnNames: ['gl_account_id'],
        referencedTableName: 'chart_of_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'journal_lines',
      new TableForeignKey({
        columnNames: ['fund_id'],
        referencedTableName: 'funds',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'journal_lines',
      new TableForeignKey({
        columnNames: ['cost_center_id'],
        referencedTableName: 'cost_centers',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    /* ---------------- voucher_sequences ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'voucher_sequences',
        columns: [
          this.uuidPk(),
          { name: 'fiscal_year', type: 'varchar', length: 9 },
          { name: 'voucher_type', type: 'varchar', length: 20 },
          { name: 'last_number', type: 'int', default: 0 },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          {
            name: 'uq_voucher_sequence_year_type',
            columnNames: ['fiscal_year', 'voucher_type'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('voucher_sequences');
    await queryRunner.dropTable('journal_lines');
    await queryRunner.dropTable('journal_entries');
  }
}
