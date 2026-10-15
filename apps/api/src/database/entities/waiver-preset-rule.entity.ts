import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Waiver preset rule (Plan §4 Workflow 2 — GPA & quota calculator config).
 * A rule matches when ALL of its set conditions hold (null = wildcard):
 * GPA band + quota tag + residence type + institution type. First match by
 * `priority` wins in the UI; Phase 3 decides stacking at invoice time.
 * Lillah rules set `requiresZakatEligible` → Fund 02 gate.
 */
@Entity('waiver_preset_rules')
export class WaiverPresetRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'rule_code', type: 'varchar', length: 40, unique: true })
  ruleCode!: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 120 })
  ruleName!: string;

  @Column({ name: 'institution_type', type: 'varchar', length: 25, nullable: true })
  institutionType?: string | null;

  @Column({ name: 'min_gpa', type: 'decimal', precision: 4, scale: 2, nullable: true })
  minGpa?: string | null;

  @Column({ name: 'max_gpa', type: 'decimal', precision: 4, scale: 2, nullable: true })
  maxGpa?: string | null;

  @Column({ name: 'quota_tag', type: 'varchar', length: 40, nullable: true })
  quotaTag?: string | null;

  @Column({ name: 'residence_type', type: 'varchar', length: 25, nullable: true })
  residenceType?: string | null;

  @Column({ name: 'waiver_type', type: 'varchar', length: 30 })
  waiverType!: string;

  @Column({ name: 'admission_fee_pct', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  admissionFeePct!: string;

  @Column({ name: 'tuition_fee_pct', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  tuitionFeePct!: string;

  @Column({ name: 'requires_zakat_eligible', type: 'boolean', default: false })
  requiresZakatEligible!: boolean;

  @Column({ name: 'priority', type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true })
  remark?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
