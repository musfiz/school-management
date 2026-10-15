import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Admission Engine Phase 1 — 7 admission/enrollment tables
 * (docs/STUDENT_ADMISSION_PLAN.md §3 + Phase 1).
 *
 * - `admission_campaigns` + `admission_applications`: circulars, seat
 *   capacity, eligibility (min GPA), merit test marks/rank, form-fee flag.
 * - `family_profiles`: parent/guardian master, NID/phone lookup keys,
 *   zakat-eligibility gate for Madrasah Lillah (Fund 02) waivers.
 * - `students` + `student_previous_educations`: master identity (permanent
 *   student_unique_id, CRVS UID, BRN) + SSC/Dakhil/HSC/TC history.
 * - `student_enrollments`: session-wise placement with roll uniqueness
 *   guards (session, class, section, roll) + (student, session).
 * - `student_documents`: verification checklist (birth cert, NIDs, TC,
 *   marksheets, orphan cert).
 *
 * Conventions: CHAR(36) UUID PKs, DECIMAL(10,2)/(12,2) money,
 * DECIMAL(4,2)/(6,2) GPA/marks, VARCHAR enums — MySQL→PG portable.
 * Plan BIGINT PKs adapted to UUID to match billing/journal tables.
 * FKs to academic sessions / classes / users are polymorphic CHAR(36)
 * (no hard FK) until the Academic Core phase lands; links to the new
 * `students` table use hard FKs.
 */
export class CreateAdmissionTables20261022100000 implements MigrationInterface {
  name = 'CreateAdmissionTables20261022100000';

  private uuidPk(name = 'id'): any {
    return { name, type: 'char', length: '36', isPrimary: true, default: '(UUID())' };
  }

  private uuidFk(name: string, nullable = true): any {
    return { name, type: 'char', length: '36', isNullable: nullable };
  }

  private gpa(name: string, nullable = true, def = "'0.00'"): any {
    return {
      name,
      type: 'decimal',
      precision: 4,
      scale: 2,
      default: nullable ? undefined : def,
      isNullable: nullable,
    };
  }

  private timestamps(withUpdated = true): any[] {
    const cols: any[] = [
      { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
    ];
    if (withUpdated) {
      cols.push({
        name: 'updated_at',
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
      });
    }
    return cols;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ---------------- admission_campaigns ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'admission_campaigns',
        columns: [
          this.uuidPk(),
          this.uuidFk('academic_session_id', false),
          this.uuidFk('class_or_dept_id', false),
          { name: 'campaign_title', type: 'varchar', length: '150' },
          {
            name: 'application_fee',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: "'0.00'",
          },
          { name: 'total_seats', type: 'int' },
          { ...this.gpa('min_required_gpa', false), default: "'0.00'" },
          { name: 'start_date', type: 'date' },
          { name: 'end_date', type: 'date' },
          { name: 'is_active', type: 'boolean', default: true },
          ...this.timestamps(),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'admission_campaigns',
      new TableIndex({ name: 'IDX_CAMPAIGNS_SESSION_CLASS', columnNames: ['academic_session_id', 'class_or_dept_id'] }),
    );
    await queryRunner.createIndex(
      'admission_campaigns',
      new TableIndex({ name: 'IDX_CAMPAIGNS_ACTIVE', columnNames: ['is_active'] }),
    );

    /* ---------------- family_profiles ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'family_profiles',
        columns: [
          this.uuidPk(),
          { name: 'family_code', type: 'varchar', length: '30', isUnique: true },
          { name: 'primary_guardian_phone', type: 'varchar', length: '20', isUnique: true },
          { name: 'father_name_en', type: 'varchar', length: '120' },
          { name: 'father_name_bn', type: 'varchar', length: '120', isNullable: true },
          { name: 'father_nid', type: 'varchar', length: '25', isNullable: true },
          { name: 'father_occupation', type: 'varchar', length: '80', isNullable: true },
          {
            name: 'father_monthly_income',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: "'0.00'",
          },
          { name: 'is_father_deceased', type: 'boolean', default: false },
          { name: 'mother_name_en', type: 'varchar', length: '120' },
          { name: 'mother_name_bn', type: 'varchar', length: '120', isNullable: true },
          { name: 'mother_nid', type: 'varchar', length: '25', isNullable: true },
          { name: 'mother_phone', type: 'varchar', length: '20', isNullable: true },
          { name: 'mother_occupation', type: 'varchar', length: '80', isNullable: true },
          { name: 'local_guardian_name', type: 'varchar', length: '120', isNullable: true },
          { name: 'local_guardian_relation', type: 'varchar', length: '50', isNullable: true },
          { name: 'local_guardian_phone', type: 'varchar', length: '20', isNullable: true },
          { name: 'local_guardian_nid', type: 'varchar', length: '25', isNullable: true },
          { name: 'present_address', type: 'text' },
          { name: 'permanent_address', type: 'text', isNullable: true },
          { name: 'upazila_thana', type: 'varchar', length: '80', isNullable: true },
          { name: 'district', type: 'varchar', length: '80', isNullable: true },
          { name: 'is_zakat_eligible_family', type: 'boolean', default: false },
          ...this.timestamps(),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'family_profiles',
      new TableIndex({ name: 'IDX_FAMILY_FATHER_NID', columnNames: ['father_nid'] }),
    );
    await queryRunner.createIndex(
      'family_profiles',
      new TableIndex({ name: 'IDX_FAMILY_ZAKAT', columnNames: ['is_zakat_eligible_family'] }),
    );

    /* ---------------- students ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'students',
        columns: [
          this.uuidPk(),
          { name: 'student_unique_id', type: 'varchar', length: '30', isUnique: true },
          { name: 'govt_uid_crvs', type: 'varchar', length: '30', isUnique: true, isNullable: true },
          this.uuidFk('family_profile_id', false),
          { name: 'full_name_en', type: 'varchar', length: '120' },
          { name: 'full_name_bn', type: 'varchar', length: '120', isNullable: true },
          { name: 'gender', type: 'varchar', length: '15' },
          { name: 'date_of_birth', type: 'date' },
          { name: 'birth_reg_no', type: 'varchar', length: '25', isUnique: true, isNullable: true },
          { name: 'national_id_no', type: 'varchar', length: '25', isNullable: true },
          { name: 'religion', type: 'varchar', length: '25' },
          { name: 'blood_group', type: 'varchar', length: '10', isNullable: true },
          { name: 'photo_url', type: 'varchar', length: '255', isNullable: true },
          { name: 'medical_allergy_notes', type: 'text', isNullable: true },
          { name: 'stipend_mfs_type', type: 'varchar', length: '20', isNullable: true },
          { name: 'stipend_account_no', type: 'varchar', length: '30', isNullable: true },
          { name: 'admission_date', type: 'date' },
          { name: 'current_status', type: 'varchar', length: '25', default: "'ACTIVE'" },
          ...this.timestamps(),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'students',
      new TableIndex({ name: 'IDX_STUDENTS_FAMILY', columnNames: ['family_profile_id'] }),
    );
    await queryRunner.createIndex(
      'students',
      new TableIndex({ name: 'IDX_STUDENTS_STATUS', columnNames: ['current_status'] }),
    );
    await queryRunner.createForeignKey(
      'students',
      new TableForeignKey({
        columnNames: ['family_profile_id'],
        referencedTableName: 'family_profiles',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    /* ---------------- admission_applications ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'admission_applications',
        columns: [
          this.uuidPk(),
          { name: 'application_no', type: 'varchar', length: '30', isUnique: true },
          this.uuidFk('campaign_id', false),
          { name: 'applicant_name_en', type: 'varchar', length: '120' },
          { name: 'applicant_name_bn', type: 'varchar', length: '120', isNullable: true },
          { name: 'gender', type: 'varchar', length: '15' },
          { name: 'date_of_birth', type: 'date' },
          { name: 'birth_reg_no', type: 'varchar', length: '25', isNullable: true },
          { name: 'guardian_phone', type: 'varchar', length: '20' },
          { name: 'prev_exam_name', type: 'varchar', length: '30', isNullable: true },
          { name: 'prev_board', type: 'varchar', length: '30', isNullable: true },
          { name: 'prev_roll_no', type: 'varchar', length: '30', isNullable: true },
          { name: 'prev_reg_no', type: 'varchar', length: '30', isNullable: true },
          { name: 'prev_passing_year', type: 'int', isNullable: true },
          { ...this.gpa('prev_gpa', true), default: undefined },
          {
            name: 'admission_test_marks',
            type: 'decimal',
            precision: 6,
            scale: 2,
            default: "'0.00'",
          },
          { name: 'merit_rank', type: 'int', isNullable: true },
          { name: 'quota_applied', type: 'varchar', length: '40', isNullable: true },
          { name: 'form_fee_paid', type: 'boolean', default: false },
          { name: 'status', type: 'varchar', length: '25', default: "'APPLIED'" },
          this.uuidFk('admitted_student_id'),
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'admission_applications',
      new TableIndex({ name: 'IDX_APPLICATIONS_CAMPAIGN', columnNames: ['campaign_id'] }),
    );
    await queryRunner.createIndex(
      'admission_applications',
      new TableIndex({ name: 'IDX_APPLICATIONS_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'admission_applications',
      new TableIndex({ name: 'IDX_APPLICATIONS_PHONE', columnNames: ['guardian_phone'] }),
    );
    await queryRunner.createIndex(
      'admission_applications',
      new TableIndex({ name: 'IDX_APPLICATIONS_MERIT', columnNames: ['campaign_id', 'merit_rank'] }),
    );
    await queryRunner.createForeignKey(
      'admission_applications',
      new TableForeignKey({
        columnNames: ['campaign_id'],
        referencedTableName: 'admission_campaigns',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'admission_applications',
      new TableForeignKey({
        columnNames: ['admitted_student_id'],
        referencedTableName: 'students',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    /* ---------------- student_previous_educations ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'student_previous_educations',
        columns: [
          this.uuidPk(),
          this.uuidFk('student_id', false),
          { name: 'exam_title', type: 'varchar', length: '40' },
          { name: 'institute_name', type: 'varchar', length: '150' },
          { name: 'education_board', type: 'varchar', length: '40', isNullable: true },
          { name: 'academic_group', type: 'varchar', length: '40', isNullable: true },
          { name: 'roll_no', type: 'varchar', length: '30', isNullable: true },
          { name: 'reg_no', type: 'varchar', length: '30', isNullable: true },
          { name: 'passing_year', type: 'int', isNullable: true },
          { ...this.gpa('gpa_obtained', true), default: undefined },
          {
            name: 'gpa_scale',
            type: 'decimal',
            precision: 4,
            scale: 2,
            default: "'5.00'",
          },
          { name: 'tc_number', type: 'varchar', length: '50', isNullable: true },
          { name: 'tc_date', type: 'date', isNullable: true },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'student_previous_educations',
      new TableIndex({ name: 'IDX_PREV_EDU_STUDENT', columnNames: ['student_id'] }),
    );
    await queryRunner.createForeignKey(
      'student_previous_educations',
      new TableForeignKey({
        columnNames: ['student_id'],
        referencedTableName: 'students',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    /* ---------------- student_enrollments ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'student_enrollments',
        columns: [
          this.uuidPk(),
          this.uuidFk('student_id', false),
          this.uuidFk('academic_session_id', false),
          { name: 'institution_type', type: 'varchar', length: '25' },
          this.uuidFk('class_or_dept_id', false),
          this.uuidFk('shift_id'),
          this.uuidFk('section_or_batch_id'),
          { name: 'academic_group', type: 'varchar', length: '40', default: "'GENERAL'" },
          { name: 'class_roll_no', type: 'int' },
          { name: 'board_registration_no', type: 'varchar', length: '40', isNullable: true },
          { name: 'enrollment_type', type: 'varchar', length: '25' },
          { name: 'residence_type', type: 'varchar', length: '25', default: "'DAY_SCHOLAR'" },
          this.uuidFk('hostel_seat_id'),
          this.uuidFk('transport_route_id'),
          { name: 'quota_tag', type: 'varchar', length: '40', default: "'NONE'" },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        uniques: [
          {
            name: 'uq_session_class_section_roll',
            columnNames: [
              'academic_session_id',
              'class_or_dept_id',
              'section_or_batch_id',
              'class_roll_no',
            ],
          },
          { name: 'uq_student_active_session', columnNames: ['student_id', 'academic_session_id'] },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'student_enrollments',
      new TableIndex({ name: 'IDX_ENROLL_STUDENT', columnNames: ['student_id'] }),
    );
    await queryRunner.createIndex(
      'student_enrollments',
      new TableIndex({
        name: 'IDX_ENROLL_SESSION_CLASS',
        columnNames: ['academic_session_id', 'class_or_dept_id'],
      }),
    );
    await queryRunner.createForeignKey(
      'student_enrollments',
      new TableForeignKey({
        columnNames: ['student_id'],
        referencedTableName: 'students',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    /* ---------------- student_documents ---------------- */
    await queryRunner.createTable(
      new Table({
        name: 'student_documents',
        columns: [
          this.uuidPk(),
          this.uuidFk('student_id', false),
          { name: 'document_type', type: 'varchar', length: '40' },
          { name: 'file_url', type: 'varchar', length: '255' },
          { name: 'is_original_submitted', type: 'boolean', default: false },
          this.uuidFk('verified_by'),
          { name: 'uploaded_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'student_documents',
      new TableIndex({ name: 'IDX_DOCS_STUDENT', columnNames: ['student_id'] }),
    );
    await queryRunner.createIndex(
      'student_documents',
      new TableIndex({ name: 'IDX_DOCS_TYPE', columnNames: ['document_type'] }),
    );
    await queryRunner.createForeignKey(
      'student_documents',
      new TableForeignKey({
        columnNames: ['student_id'],
        referencedTableName: 'students',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'student_documents',
      new TableForeignKey({
        columnNames: ['verified_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('student_documents', true);
    await queryRunner.dropTable('student_enrollments', true);
    await queryRunner.dropTable('admission_applications', true);
    await queryRunner.dropTable('student_previous_educations', true);
    await queryRunner.dropTable('students', true);
    await queryRunner.dropTable('family_profiles', true);
    await queryRunner.dropTable('admission_campaigns', true);
  }
}
