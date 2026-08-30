import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly dataSource: DataSource) {}

  async runMigrations(): Promise<string> {
    this.logger.log('Running pending migrations...');
    const results = await this.dataSource.runMigrations();
    if (results.length === 0) {
      return 'No pending migrations.';
    }
    const names = results.map((r) => r.name).join(', ');
    this.logger.log(`Ran ${results.length} migration(s): ${names}`);
    return `Ran ${results.length} migration(s): ${names}`;
  }

  async revertLastMigration(): Promise<string> {
    this.logger.log('Reverting last migration...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const migrations = await queryRunner.query(
      'SELECT * FROM migrations ORDER BY id DESC LIMIT 1',
    );
    await queryRunner.release();

    if (migrations.length === 0) {
      return 'No migration to revert.';
    }

    await this.dataSource.undoLastMigration();
    const name = migrations[0].name;
    this.logger.log(`Reverted: ${name}`);
    return `Reverted: ${name}`;
  }
}
