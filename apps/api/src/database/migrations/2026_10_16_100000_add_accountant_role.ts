import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `accountant` value to the native `users.role` ENUM
 * (admin-superior approval hierarchy needs a distinct accountant role).
 */
export class AddAccountantRole20261016100000 implements MigrationInterface {
  name = 'AddAccountantRole20261016100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM('admin','management','accountant','teacher','student','guardian') NOT NULL DEFAULT 'student'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Guard: reverting with accountant rows present would fail — the
    // operator must reassign those users first.
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM('admin','management','teacher','student','guardian') NOT NULL DEFAULT 'student'`,
    );
  }
}
