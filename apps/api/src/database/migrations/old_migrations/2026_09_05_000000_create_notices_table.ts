import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateNoticesTable20260905000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notices',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'title_bn',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '100',
            default: "'General'",
          },
          {
            name: 'short_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'short_description_bn',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'longtext',
            isNullable: true,
          },
          {
            name: 'description_bn',
            type: 'longtext',
            isNullable: true,
          },
          {
            name: 'image_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'pdf_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'is_pinned',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'publish_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notices',
      new TableIndex({
        name: 'IDX_notices_category',
        columnNames: ['category'],
      }),
    );
    await queryRunner.createIndex(
      'notices',
      new TableIndex({
        name: 'IDX_notices_is_pinned',
        columnNames: ['is_pinned'],
      }),
    );
    await queryRunner.createIndex(
      'notices',
      new TableIndex({
        name: 'IDX_notices_is_active',
        columnNames: ['is_active'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notices');
  }
}
