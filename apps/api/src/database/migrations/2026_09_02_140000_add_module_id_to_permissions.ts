import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddModuleIdToPermissions1788528100000 implements MigrationInterface {
  name = 'AddModuleIdToPermissions1788528100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'permissions',
      new TableColumn({
        name: 'module_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'permissions',
      new TableForeignKey({
        columnNames: ['module_id'],
        referencedTableName: 'modules',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('permissions');
    const fk = table?.foreignKeys.find((f) =>
      f.columnNames.includes('module_id'),
    );
    if (fk) {
      await queryRunner.dropForeignKey('permissions', fk);
    }
    await queryRunner.dropColumn('permissions', 'module_id');
  }
}
