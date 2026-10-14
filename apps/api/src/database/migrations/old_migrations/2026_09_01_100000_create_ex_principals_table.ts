import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateExPrincipalsTable1788510000000 implements MigrationInterface {
  name = 'CreateExPrincipalsTable1788510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ex_principals',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'name_bn', type: 'varchar', length: '150', isNullable: true },
          { name: 'tenure', type: 'varchar', length: '150', isNullable: true },
          { name: 'image_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'sort_order', type: 'int', default: 0 },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ex_principals');
  }
}
