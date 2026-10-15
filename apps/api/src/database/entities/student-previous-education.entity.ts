import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Student } from './student.entity';

/**
 * Previous academic history rows (Plan §3.3 — SSC/Dakhil/HSC/TC trail).
 * One student → many rows (CASCADE on student delete).
 */
@Entity('student_previous_educations')
export class StudentPreviousEducation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'exam_title', type: 'varchar', length: 40 })
  examTitle!: string;

  @Column({ name: 'institute_name', type: 'varchar', length: 150 })
  instituteName!: string;

  @Column({ name: 'education_board', type: 'varchar', length: 40, nullable: true })
  educationBoard?: string | null;

  @Column({ name: 'academic_group', type: 'varchar', length: 40, nullable: true })
  academicGroup?: string | null;

  @Column({ name: 'roll_no', type: 'varchar', length: 30, nullable: true })
  rollNo?: string | null;

  @Column({ name: 'reg_no', type: 'varchar', length: 30, nullable: true })
  regNo?: string | null;

  @Column({ name: 'passing_year', type: 'int', nullable: true })
  passingYear?: number | null;

  @Column({
    name: 'gpa_obtained',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  gpaObtained?: string | null;

  @Column({
    name: 'gpa_scale',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: '5.00',
  })
  gpaScale!: string;

  @Column({ name: 'tc_number', type: 'varchar', length: 50, nullable: true })
  tcNumber?: string | null;

  @Column({ name: 'tc_date', type: 'date', nullable: true })
  tcDate?: string | null;
}
