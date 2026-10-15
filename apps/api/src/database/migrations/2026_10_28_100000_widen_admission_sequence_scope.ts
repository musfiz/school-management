import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix: ROLL sequence scope keys are
 * `ROLL:<36-char session>:<36-char class>:<section>` — up to ~115 chars — which
 * overflowed the original `varchar(80)`. The failed INSERT was swallowed by
 * SequenceService and surfaced as a misleading "sequence contended — retry"
 * on every admission confirm. Widen the column to hold any scope key.
 */
export class WidenAdmissionSequenceScope20261028100000 implements MigrationInterface {
  name = 'WidenAdmissionSequenceScope20261028100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE admission_sequences MODIFY COLUMN scope_key VARCHAR(160) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE admission_sequences MODIFY COLUMN scope_key VARCHAR(80) NOT NULL`,
    );
  }
}
