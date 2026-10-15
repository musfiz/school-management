import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ClassSyllabusSubject } from './class-syllabus-subject.entity';

export type AssignedSubjectRole = 'COMPULSORY' | 'FOURTH_OPTIONAL' | 'NON_CREDIT';

/**
 * Per-student subject enrollment (Result Plan §2 + Admission Workflow 3).
 * GROUP_ELECTIVE syllabus rows enroll as COMPULSORY (required for the
 * student's group); the single picked 4th subject stays FOURTH_OPTIONAL.
 */
@Entity('student_subject_enrollments')
@Unique('uq_student_sub_enroll', ['academicSessionId', 'studentId', 'syllabusSubjectId'])
export class StudentSubjectEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'academic_session_id', type: 'char', length: 36 })
  academicSessionId!: string;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @Column({ name: 'syllabus_subject_id', type: 'char', length: 36 })
  syllabusSubjectId!: string;

  @ManyToOne(() => ClassSyllabusSubject, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'syllabus_subject_id' })
  syllabusSubject?: ClassSyllabusSubject;

  @Column({ name: 'assigned_role', type: 'varchar', length: 30 })
  assignedRole!: AssignedSubjectRole;
}
