import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateMenuItemsTable1788166293518 implements MigrationInterface {
  name = 'CreateMenuItemsTable1788166293518';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'menu_items',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'menu_location',
            type: 'varchar',
            length: '30',
            default: "'header'",
          },
          {
            name: 'parent_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'label_en',
            type: 'varchar',
            length: '150',
          },
          {
            name: 'label_bn',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'href',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'sort_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'is_visible',
            type: 'boolean',
            default: true,
          },
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

    await queryRunner.createIndex(
      'menu_items',
      new TableIndex({
        name: 'IDX_MENU_ITEMS_LOCATION',
        columnNames: ['menu_location'],
      }),
    );

    await queryRunner.createForeignKey(
      'menu_items',
      new TableForeignKey({
        name: 'FK_MENU_ITEMS_PARENT',
        columnNames: ['parent_id'],
        referencedTableName: 'menu_items',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('menu_items', 'FK_MENU_ITEMS_PARENT');
    await queryRunner.dropIndex('menu_items', 'IDX_MENU_ITEMS_LOCATION');
    await queryRunner.dropTable('menu_items');
  }
}
