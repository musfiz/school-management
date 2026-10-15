import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Workflow 3 handshake tables (Result Plan §2, Admission Plan §4 Workflow 3).
 * - `academic_subjects`: master catalogue (Bangla 1st/2nd … Honours credits).
 * - `class_syllabus_subjects`: session × class matrix with roles, paper
 *   merge groups, credit hours, full marks. `elective_group` is an
 *   admission-side extension: which academic_group a GROUP_ELECTIVE
 *   belongs to (matched at admission time).
 * - `student_subject_enrollments`: per-student rows with the Result-Plan
 *   uniqueness guard (session, student, syllabus_subject).
 */
export class CreateSubjectTables20261024100000 implements MigrationInterface {
  name = 'CreateSubjectTables20261024100000';

  private uuidPk(): any {
    return { name: 'id', type: 'char', length: '36', isPrimary: true, default: '(UUID())' };
  }

  private uuidFk(name: string, nullable = true): any {
    return { name, type: 'char', length: '36', isNullable: nullable };
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'academic_subjects',
        columns: [
          this.uuidPk(),
          { name: 'subject_code', type: 'varchar', length: '30' },
          { name: 'subject_name', type: 'varchar', length: '150' },
          { name: 'board_stream', type: 'varchar', length: '30', default: "'GENERAL'" },
          { name: 'paper_number', type: 'int', isNullable: true },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'academic_subjects',
      new TableIndex({ name: 'IDX_SUBJECTS_CODE', columnNames: ['subject_code'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'class_syllabus_subjects',
        columns: [
          this.uuidPk(),
          this.uuidFk('academic_session_id', false),
          this.uuidFk('class_or_dept_id', false),
          this.uuidFk('subject_id', false),
          { name: 'combined_group_code', type: 'varchar', length: '40', isNullable: true },
          { name: 'combined_group_name', type: 'varchar', length: '100', isNullable: true },
          { name: 'default_subject_role', type: 'varchar', length: '30' },
          { name: 'elective_group', type: 'varchar', length: '40', isNullable: true },
          { name: 'credit_hours', type: 'decimal', precision: 4, scale: 2, default: "'0.00'" },
          { name: 'full_marks', type: 'decimal', precision: 6, scale: 2, default: "'100.00'" },
          { name: 'pass_evaluation_mode', type: 'varchar', length: '40', default: "'SEPARATE_COMPONENTS'" },
          { name: 'display_order', type: 'int', default: 1 },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'class_syllabus_subjects',
      new TableIndex({
        name: 'IDX_SYLLABUS_SESSION_CLASS',
        columnNames: ['academic_session_id', 'class_or_dept_id'],
      }),
    );
    await queryRunner.createForeignKey(
      'class_syllabus_subjects',
      new TableForeignKey({
        columnNames: ['subject_id'],
        referencedTableName: 'academic_subjects',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'student_subject_enrollments',
        columns: [
          this.uuidPk(),
          this.uuidFk('academic_session_id', false),
          this.uuidFk('student_id', false),
          this.uuidFk('syllabus_subject_id', false),
          { name: 'assigned_role', type: 'varchar', length: 30 },
        ],
        uniques: [
          {
            name: 'uq_student_sub_enroll',
            columnNames: ['academic_session_id', 'student_id', 'syllabus_subject_id'],
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'student_subject_enrollments',
      new TableIndex({ name: 'IDX_SUB_ENROLL_STUDENT', columnNames: ['student_id'] }),
    );
    await queryRunner.createIndex(
      'student_subject_enrollments',
      new TableIndex({
        name: 'IDX_SUB_ENROLL_SESSION',
        columnNames: ['academic_session_id', 'student_id'],
      }),
    );
    await queryRunner.createForeignKey(
      'student_subject_enrollments',
      new TableForeignKey({
        columnNames: ['syllabus_subject_id'],
        referencedTableName: 'class_syllabus_subjects',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('student_subject_enrollments', true);
    await queryRunner.dropTable('class_syllabus_subjects', true);
    await queryRunner.dropTable('academic_subjects', true);
  }
}
