import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePagesTable1788253000000 implements MigrationInterface {
  name = 'CreatePagesTable1788253000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'pages',
        columns: [
          { name: 'slug', type: 'varchar', length: '60', isPrimary: true },
          { name: 'title_en', type: 'varchar', length: '200' },
          { name: 'title_bn', type: 'varchar', length: '200', isNullable: true },
          { name: 'content_en', type: 'text', isNullable: true },
          { name: 'content_bn', type: 'text', isNullable: true },
          { name: 'image_url', type: 'varchar', length: '255', isNullable: true },
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
    await queryRunner.dropTable('pages');
  }
}
