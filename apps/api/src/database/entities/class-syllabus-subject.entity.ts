import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AcademicSubject } from './academic-subject.entity';

export type SyllabusSubjectRole = 'COMPULSORY' | 'GROUP_ELECTIVE' | 'FOURTH_OPTIONAL' | 'NON_CREDIT';

/**
 * Class × session syllabus matrix (Result Plan §2).
 * `defaultSubjectRole` GROUP_ELECTIVE rows carry the group they belong to
 * in `electiveGroup` (e.g. 'SCIENCE' — matched against the student's
 * academic_group at admission). 1st/2nd papers share a combined_group_code.
 */
@Entity('class_syllabus_subjects')
export class ClassSyllabusSubject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'academic_session_id', type: 'char', length: 36 })
  academicSessionId!: string;

  @Column({ name: 'class_or_dept_id', type: 'char', length: 36 })
  classOrDeptId!: string;

  @Column({ name: 'subject_id', type: 'char', length: 36 })
  subjectId!: string;

  @ManyToOne(() => AcademicSubject, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subject_id' })
  subject?: AcademicSubject;

  @Column({ name: 'combined_group_code', type: 'varchar', length: 40, nullable: true })
  combinedGroupCode?: string | null;

  @Column({ name: 'combined_group_name', type: 'varchar', length: 100, nullable: true })
  combinedGroupName?: string | null;

  @Column({ name: 'default_subject_role', type: 'varchar', length: 30 })
  defaultSubjectRole!: SyllabusSubjectRole;

  /** Academic group this GROUP_ELECTIVE belongs to (e.g. 'SCIENCE'); null otherwise. */
  @Column({ name: 'elective_group', type: 'varchar', length: 40, nullable: true })
  electiveGroup?: string | null;

  @Column({ name: 'credit_hours', type: 'decimal', precision: 4, scale: 2, default: '0.00' })
  creditHours!: string;

  @Column({ name: 'full_marks', type: 'decimal', precision: 6, scale: 2, default: '100.00' })
  fullMarks!: string;

  @Column({
    name: 'pass_evaluation_mode',
    type: 'varchar',
    length: 40,
    default: 'SEPARATE_COMPONENTS',
  })
  passEvaluationMode!: string;

  @Column({ name: 'display_order', type: 'int', default: 1 })
  displayOrder!: number;
}
