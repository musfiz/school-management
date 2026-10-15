import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Required Document Rule (Plan §2 settings — per-class required-document checklist).
 * One rule per (class_or_dept_id, document_type) pair — enforces which
 * document types must be submitted (original held or copies acceptable)
 * before an admission can be confirmed.
 */
@Entity('required_document_rules')
export class RequiredDocumentRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'class_or_dept_id', type: 'varchar', length: 36 })
  classOrDeptId!: string;

  @Column({ name: 'document_type', type: 'varchar', length: 40 })
  documentType!: string;

  @Column({ name: 'is_original_required', type: 'boolean', default: true })
  isOriginalRequired!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}