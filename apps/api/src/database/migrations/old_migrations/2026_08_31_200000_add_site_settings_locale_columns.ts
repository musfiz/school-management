import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSiteSettingsLocaleColumns1788254000000 implements MigrationInterface {
  name = 'AddSiteSettingsLocaleColumns1788254000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('site_settings', [
      new TableColumn({ name: 'site_name_bn', type: 'varchar', length: '150', isNullable: true }),
      new TableColumn({ name: 'tagline_bn', type: 'varchar', length: '200', isNullable: true }),
      new TableColumn({ name: 'description_bn', type: 'text', isNullable: true }),
      new TableColumn({ name: 'address_bn', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({
        name: 'copyright_text_bn',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('site_settings', [
      'site_name_bn',
      'tagline_bn',
      'description_bn',
      'address_bn',
      'copyright_text_bn',
    ]);
  }
}
