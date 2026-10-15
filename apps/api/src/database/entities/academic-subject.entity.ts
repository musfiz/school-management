import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Master subject catalogue (Result Plan §2 — shared with Result Engine).
 * Board paper numbering: paper_number 1/2 (NULL for single-paper/tertiary).
 */
@Entity('academic_subjects')
export class AcademicSubject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'subject_code', type: 'varchar', length: 30 })
  subjectCode!: string;

  @Column({ name: 'subject_name', type: 'varchar', length: 150 })
  subjectName!: string;

  @Column({ name: 'board_stream', type: 'varchar', length: 30, default: 'GENERAL' })
  boardStream!: string;

  @Column({ name: 'paper_number', type: 'int', nullable: true })
  paperNumber?: number | null;
}
