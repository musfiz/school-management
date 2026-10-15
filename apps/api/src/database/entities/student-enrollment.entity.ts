import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Student } from './student.entity';

/**
 * Session-wise academic enrollment (Plan §3.4).
 * Guards: unique roll within (session, class, section) + one active row
 * per (student, session).
 */
@Entity('student_enrollments')
@Unique('uq_session_class_section_roll', [
  'academicSessionId',
  'classOrDeptId',
  'sectionOrBatchId',
  'classRollNo',
])
@Unique('uq_student_active_session', ['studentId', 'academicSessionId'])
export class StudentEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @ManyToOne(() => Student, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'academic_session_id', type: 'char', length: 36 })
  academicSessionId!: string;

  @Column({ name: 'institution_type', type: 'varchar', length: 25 })
  institutionType!: string;

  @Column({ name: 'class_or_dept_id', type: 'char', length: 36 })
  classOrDeptId!: string;

  @Column({ name: 'shift_id', type: 'char', length: 36, nullable: true })
  shiftId?: string | null;

  @Column({ name: 'section_or_batch_id', type: 'char', length: 36, nullable: true })
  sectionOrBatchId?: string | null;

  @Column({ name: 'academic_group', type: 'varchar', length: 40, default: 'GENERAL' })
  academicGroup!: string;

  @Column({ name: 'class_roll_no', type: 'int' })
  classRollNo!: number;

  @Column({ name: 'board_registration_no', type: 'varchar', length: 40, nullable: true })
  boardRegistrationNo?: string | null;

  @Column({ name: 'enrollment_type', type: 'varchar', length: 25 })
  enrollmentType!: string;

  @Column({ name: 'residence_type', type: 'varchar', length: 25, default: 'DAY_SCHOLAR' })
  residenceType!: string;

  @Column({ name: 'hostel_seat_id', type: 'char', length: 36, nullable: true })
  hostelSeatId?: string | null;

  @Column({ name: 'transport_route_id', type: 'char', length: 36, nullable: true })
  transportRouteId?: string | null;

  @Column({ name: 'quota_tag', type: 'varchar', length: 40, default: 'NONE' })
  quotaTag!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
