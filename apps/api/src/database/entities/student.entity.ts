import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FamilyProfile } from './family-profile.entity';

export type StudentStatus = 'ACTIVE' | 'TC_ISSUED' | 'GRADUATED' | 'DROPPED' | 'SUSPENDED';

export const STUDENT_STATUSES: StudentStatus[] = [
  'ACTIVE',
  'TC_ISSUED',
  'GRADUATED',
  'DROPPED',
  'SUSPENDED',
];

/**
 * Master student identity (Plan §3.3).
 * Permanent `studentUniqueId` + optional Govt CRVS UID; links to Accounting
 * (student_invoices) and Result (student_subject_enrollments) modules.
 */
@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_unique_id', type: 'varchar', length: 30, unique: true })
  studentUniqueId!: string;

  @Column({ name: 'govt_uid_crvs', type: 'varchar', length: 30, unique: true, nullable: true })
  govtUidCrvs?: string | null;

  @Column({ name: 'family_profile_id', type: 'char', length: 36 })
  familyProfileId!: string;

  @ManyToOne(() => FamilyProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'family_profile_id' })
  familyProfile?: FamilyProfile;

  @Column({ name: 'full_name_en', type: 'varchar', length: 120 })
  fullNameEn!: string;

  @Column({ name: 'full_name_bn', type: 'varchar', length: 120, nullable: true })
  fullNameBn?: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 15 })
  gender!: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: string;

  @Column({ name: 'birth_reg_no', type: 'varchar', length: 25, unique: true, nullable: true })
  birthRegNo?: string | null;

  @Column({ name: 'national_id_no', type: 'varchar', length: 25, nullable: true })
  nationalIdNo?: string | null;

  @Column({ name: 'religion', type: 'varchar', length: 25 })
  religion!: string;

  @Column({ name: 'blood_group', type: 'varchar', length: 10, nullable: true })
  bloodGroup?: string | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 255, nullable: true })
  photoUrl?: string | null;

  @Column({ name: 'medical_allergy_notes', type: 'text', nullable: true })
  medicalAllergyNotes?: string | null;

  @Column({ name: 'stipend_mfs_type', type: 'varchar', length: 20, nullable: true })
  stipendMfsType?: string | null;

  @Column({ name: 'stipend_account_no', type: 'varchar', length: 30, nullable: true })
  stipendAccountNo?: string | null;

  /** Kindergarten pick-up guardian (Phase 4 KG mode). */
  @Column({ name: 'pickup_guardian_name', type: 'varchar', length: 120, nullable: true })
  pickupGuardianName?: string | null;

  @Column({ name: 'pickup_guardian_phone', type: 'varchar', length: 20, nullable: true })
  pickupGuardianPhone?: string | null;

  @Column({ name: 'admission_date', type: 'date' })
  admissionDate!: string;

  @Column({ name: 'current_status', type: 'varchar', length: 25, default: 'ACTIVE' })
  currentStatus!: StudentStatus;

  /** Transfer Certificate trail (Phase 5) — set when status → TC_ISSUED. */
  @Column({ name: 'tc_number', type: 'varchar', length: 50, nullable: true })
  tcNumber?: string | null;

  @Column({ name: 'tc_issue_date', type: 'date', nullable: true })
  tcIssueDate?: string | null;

  @Column({ name: 'tc_remark', type: 'varchar', length: 255, nullable: true })
  tcRemark?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
