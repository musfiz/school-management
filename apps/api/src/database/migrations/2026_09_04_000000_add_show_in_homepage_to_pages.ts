import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddShowInHomepageToPages1788700000000 implements MigrationInterface {
  name = 'AddShowInHomepageToPages1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'pages',
      new TableColumn({
        name: 'show_in_homepage',
        type: 'boolean',
        default: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('pages', 'show_in_homepage');
  }
}
