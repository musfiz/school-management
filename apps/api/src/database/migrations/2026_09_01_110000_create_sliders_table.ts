import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSlidersTable1788512000000 implements MigrationInterface {
  name = 'CreateSlidersTable1788512000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sliders',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'image_url', type: 'varchar', length: '255' },
          { name: 'title_en', type: 'varchar', length: '200', isNullable: true },
          { name: 'title_bn', type: 'varchar', length: '200', isNullable: true },
          { name: 'sort_order', type: 'int', default: 0 },
          { name: 'is_active', type: 'boolean', default: true },
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
    await queryRunner.dropTable('sliders');
  }
}
