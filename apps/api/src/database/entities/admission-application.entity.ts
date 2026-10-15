import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { AdmissionCampaign } from './admission-campaign.entity';

export type AdmissionApplicationStatus =
  | 'APPLIED'
  | 'SHORTLISTED'
  | 'WAITING'
  | 'ADMITTED'
  | 'REJECTED';

export const ADMISSION_APPLICATION_STATUSES: AdmissionApplicationStatus[] = [
  'APPLIED',
  'SHORTLISTED',
  'WAITING',
  'ADMITTED',
  'REJECTED',
];

/**
 * Online / walk-in application (Plan §3.1).
 * `admittedStudentId` is back-filled on convert-to-admission (SET NULL).
 */
@Entity('admission_applications')
export class AdmissionApplication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_no', type: 'varchar', length: 30, unique: true })
  applicationNo!: string;

  @Column({ name: 'campaign_id', type: 'char', length: 36 })
  campaignId!: string;

  @ManyToOne(() => AdmissionCampaign, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: AdmissionCampaign;

  @Column({ name: 'applicant_name_en', type: 'varchar', length: 120 })
  applicantNameEn!: string;

  @Column({ name: 'applicant_name_bn', type: 'varchar', length: 120, nullable: true })
  applicantNameBn?: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 15 })
  gender!: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: string;

  @Column({ name: 'birth_reg_no', type: 'varchar', length: 25, nullable: true })
  birthRegNo?: string | null;

  @Column({ name: 'guardian_phone', type: 'varchar', length: 20 })
  guardianPhone!: string;

  @Column({ name: 'prev_exam_name', type: 'varchar', length: 30, nullable: true })
  prevExamName?: string | null;

  @Column({ name: 'prev_board', type: 'varchar', length: 30, nullable: true })
  prevBoard?: string | null;

  @Column({ name: 'prev_roll_no', type: 'varchar', length: 30, nullable: true })
  prevRollNo?: string | null;

  @Column({ name: 'prev_reg_no', type: 'varchar', length: 30, nullable: true })
  prevRegNo?: string | null;

  @Column({ name: 'prev_passing_year', type: 'int', nullable: true })
  prevPassingYear?: number | null;

  @Column({
    name: 'prev_gpa',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  prevGpa?: string | null;

  @Column({
    name: 'admission_test_marks',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: '0.00',
  })
  admissionTestMarks!: string;

  @Column({ name: 'merit_rank', type: 'int', nullable: true })
  meritRank?: number | null;

  @Column({ name: 'quota_applied', type: 'varchar', length: 40, nullable: true })
  quotaApplied?: string | null;

  @Column({ name: 'form_fee_paid', type: 'boolean', default: false })
  formFeePaid!: boolean;

  @Column({ name: 'status', type: 'varchar', length: 25, default: 'APPLIED' })
  status!: AdmissionApplicationStatus;

  @Column({ name: 'admitted_student_id', type: 'char', length: 36, nullable: true })
  admittedStudentId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
