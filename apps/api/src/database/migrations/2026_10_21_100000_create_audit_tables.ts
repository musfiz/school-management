import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Phase 7 & 8.5 — Accounting audit trail & event logging tables (spec §1.7).
 * - `accounting_audit_logs`: immutable audit entries capturing maker/checker/approver
 *   milestones, reversals, and statutory compliance events.
 */
export class CreateAuditTables20261021100000 implements MigrationInterface {
  name = 'CreateAuditTables20261021100000';

  private uuidPk(name = 'id'): any {
    return { name, type: 'char', length: '36', isPrimary: true, default: '(UUID())' };
  }

  private uuidFk(name: string, nullable = true): any {
    return { name, type: 'char', length: '36', isNullable: nullable };
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'accounting_audit_logs',
        columns: [
          this.uuidPk(),
          { name: 'event_type', type: 'varchar', length: '50' },
          { name: 'entity_type', type: 'varchar', length: '50' },
          this.uuidFk('entity_id', false),
          { name: 'entity_reference', type: 'varchar', length: '100', isNullable: true },
          this.uuidFk('actor_id', true),
          { name: 'action', type: 'varchar', length: '50' },
          { name: 'details', type: 'text', isNullable: true },
          { name: 'ip_address', type: 'varchar', length: '50', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'accounting_audit_logs',
      new TableIndex({ name: 'IDX_AUDIT_LOG_EVENT_TYPE', columnNames: ['event_type'] }),
    );
    await queryRunner.createIndex(
      'accounting_audit_logs',
      new TableIndex({ name: 'IDX_AUDIT_LOG_ENTITY', columnNames: ['entity_type', 'entity_id'] }),
    );
    await queryRunner.createIndex(
      'accounting_audit_logs',
      new TableIndex({ name: 'IDX_AUDIT_LOG_ACTOR', columnNames: ['actor_id'] }),
    );
    await queryRunner.createIndex(
      'accounting_audit_logs',
      new TableIndex({ name: 'IDX_AUDIT_LOG_CREATED_AT', columnNames: ['created_at'] }),
    );

    await queryRunner.createForeignKey(
      'accounting_audit_logs',
      new TableForeignKey({
        columnNames: ['actor_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('accounting_audit_logs', true);
  }
}
