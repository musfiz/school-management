import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTeachersTable1788520000000 implements MigrationInterface {
  name = 'CreateTeachersTable1788520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'teachers',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '150' },
          { name: 'name_bn', type: 'varchar', length: '150', isNullable: true },
          { name: 'designation', type: 'varchar', length: '150' },
          { name: 'designation_bn', type: 'varchar', length: '150', isNullable: true },
          { name: 'department', type: 'varchar', length: '150', isNullable: true },
          { name: 'department_bn', type: 'varchar', length: '150', isNullable: true },
          { name: 'image_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'joint_date', type: 'date', isNullable: true },
          { name: 'sort_order', type: 'int', default: 0 },
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
    await queryRunner.dropTable('teachers');
  }
}
