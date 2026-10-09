import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateHeroSectionsTable1788600000000 implements MigrationInterface {
  name = 'CreateHeroSectionsTable1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'hero_sections',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            default: '1',
          },
          {
            name: 'is_visible',
            type: 'boolean',
            default: true,
          },
          {
            name: 'admission_year',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'tagline_1',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tagline_1_bn',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tagline_2',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tagline_2_bn',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tagline_3',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tagline_3_bn',
            type: 'varchar',
            length: '255',
            isNullable: true,
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
            name: 'show_apply_button',
            type: 'boolean',
            default: true,
          },
          {
            name: 'institute_open_info',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'institute_open_info_bn',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '50',
            isNullable: true,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('hero_sections');
  }
}
