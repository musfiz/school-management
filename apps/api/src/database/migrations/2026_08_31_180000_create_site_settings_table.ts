import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSiteSettingsTable1788252693518 implements MigrationInterface {
  name = 'CreateSiteSettingsTable1788252693518';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'site_settings',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, default: 1 },
          { name: 'site_name', type: 'varchar', length: '150', default: "'My School'" },
          { name: 'tagline', type: 'varchar', length: '200', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'logo_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'header_display', type: 'varchar', length: '10', default: "'both'" },
          { name: 'phone', type: 'varchar', length: '30', isNullable: true },
          { name: 'email', type: 'varchar', length: '150', isNullable: true },
          { name: 'address', type: 'varchar', length: '255', isNullable: true },
          { name: 'established', type: 'int', isNullable: true },
          { name: 'eiin', type: 'varchar', length: '30', isNullable: true },
          { name: 'facebook_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'twitter_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'linkedin_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'youtube_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'copyright_text', type: 'varchar', length: '255', isNullable: true },
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
    await queryRunner.dropTable('site_settings');
  }
}
