import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateHomepageTables1788600000000 implements MigrationInterface {
  name = 'CreateHomepageTables1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'homepage_sections',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'section_key', type: 'varchar', length: '60', isUnique: true },
          { name: 'label_en', type: 'varchar', length: '120' },
          { name: 'label_bn', type: 'varchar', length: '120', isNullable: true },
          { name: 'eyebrow_en', type: 'varchar', length: '120', isNullable: true },
          { name: 'eyebrow_bn', type: 'varchar', length: '120', isNullable: true },
          { name: 'title_en', type: 'varchar', length: '200', isNullable: true },
          { name: 'title_bn', type: 'varchar', length: '200', isNullable: true },
          { name: 'body_en', type: 'text', isNullable: true },
          { name: 'body_bn', type: 'text', isNullable: true },
          { name: 'image_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'cta_text_en', type: 'varchar', length: '80', isNullable: true },
          { name: 'cta_text_bn', type: 'varchar', length: '80', isNullable: true },
          { name: 'cta_href', type: 'varchar', length: '255', isNullable: true },
          { name: 'background', type: 'varchar', length: '20', default: 'white' },
          { name: 'sort_order', type: 'int', default: 0 },
          { name: 'is_visible', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'homepage_items',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'section_id', type: 'int' },
          { name: 'item_key', type: 'varchar', length: '40', default: 'card' },
          { name: 'title_en', type: 'varchar', length: '200', isNullable: true },
          { name: 'title_bn', type: 'varchar', length: '200', isNullable: true },
          { name: 'subtitle_en', type: 'varchar', length: '200', isNullable: true },
          { name: 'subtitle_bn', type: 'varchar', length: '200', isNullable: true },
          { name: 'body_en', type: 'text', isNullable: true },
          { name: 'body_bn', type: 'text', isNullable: true },
          { name: 'icon', type: 'varchar', length: '40', isNullable: true },
          { name: 'image_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'href', type: 'varchar', length: '255', isNullable: true },
          { name: 'meta_en', type: 'varchar', length: '60', isNullable: true },
          { name: 'meta_bn', type: 'varchar', length: '60', isNullable: true },
          { name: 'sort_order', type: 'int', default: 0 },
          { name: 'is_visible', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    // Look up a section's items on every public render, so index the FK.
    await queryRunner.createIndex(
      'homepage_items',
      new TableIndex({ name: 'idx_homepage_items_section', columnNames: ['section_id'] }),
    );
    // The public query filters on is_visible and sorts on sort_order.
    await queryRunner.createIndex(
      'homepage_sections',
      new TableIndex({ name: 'idx_homepage_sections_visible_order', columnNames: ['is_visible', 'sort_order'] }),
    );

    await queryRunner.createForeignKey(
      'homepage_items',
      new TableForeignKey({
        name: 'fk_homepage_items_section',
        columnNames: ['section_id'],
        referencedTableName: 'homepage_sections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('homepage_items', 'fk_homepage_items_section');
    await queryRunner.dropTable('homepage_items');
    await queryRunner.dropTable('homepage_sections');
  }
}