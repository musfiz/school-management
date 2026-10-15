import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Student } from './student.entity';

/**
 * Student document + verification checklist (Plan §3.5).
 * `verifiedBy` → users.id (SET NULL); file rows CASCADE with student.
 */
@Entity('student_documents')
export class StudentDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'document_type', type: 'varchar', length: 40 })
  documentType!: string;

  @Column({ name: 'file_url', type: 'varchar', length: 255 })
  fileUrl!: string;

  @Column({ name: 'is_original_submitted', type: 'boolean', default: false })
  isOriginalSubmitted!: boolean;

  @Column({ name: 'verified_by', type: 'char', length: 36, nullable: true })
  verifiedBy?: string | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamp' })
  uploadedAt!: Date;
}
