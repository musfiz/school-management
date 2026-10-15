import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Admission campaign / circular (Plan §3.1 — pre-admission).
 * Seat capacity + eligibility gate (min GPA) per class/dept + session.
 * Money = DECIMAL(10,2); GPA = DECIMAL(4,2). UUID PK per repo portability rule
 * (plan's BIGINT adapted to CHAR(36) to match billing/journal tables).
 */
@Entity('admission_campaigns')
export class AdmissionCampaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'academic_session_id', type: 'char', length: 36 })
  academicSessionId!: string;

  @Column({ name: 'class_or_dept_id', type: 'char', length: 36 })
  classOrDeptId!: string;

  @Column({ name: 'campaign_title', type: 'varchar', length: 150 })
  campaignTitle!: string;

  @Column({
    name: 'application_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: '0.00',
  })
  applicationFee!: string;

  @Column({ name: 'total_seats', type: 'int' })
  totalSeats!: number;

  @Column({
    name: 'min_required_gpa',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: '0.00',
  })
  minRequiredGpa!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
