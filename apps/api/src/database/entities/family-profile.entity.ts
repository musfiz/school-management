import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Family / parent registry (Plan §3.2 — multi-sibling linkage).
 * `primaryGuardianPhone` is the Parent Portal login + SMS key (unique).
 * `isZakatEligibleFamily` gates Madrasah Lillah/Zakat (Fund 02) waivers.
 */
@Entity('family_profiles')
export class FamilyProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'family_code', type: 'varchar', length: 30, unique: true })
  familyCode!: string;

  @Column({ name: 'primary_guardian_phone', type: 'varchar', length: 20, unique: true })
  primaryGuardianPhone!: string;

  @Column({ name: 'father_name_en', type: 'varchar', length: 120 })
  fatherNameEn!: string;

  @Column({ name: 'father_name_bn', type: 'varchar', length: 120, nullable: true })
  fatherNameBn?: string | null;

  @Column({ name: 'father_nid', type: 'varchar', length: 25, nullable: true })
  fatherNid?: string | null;

  @Column({ name: 'father_occupation', type: 'varchar', length: 80, nullable: true })
  fatherOccupation?: string | null;

  @Column({
    name: 'father_monthly_income',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  fatherMonthlyIncome!: string;

  @Column({ name: 'is_father_deceased', type: 'boolean', default: false })
  isFatherDeceased!: boolean;

  @Column({ name: 'mother_name_en', type: 'varchar', length: 120 })
  motherNameEn!: string;

  @Column({ name: 'mother_name_bn', type: 'varchar', length: 120, nullable: true })
  motherNameBn?: string | null;

  @Column({ name: 'mother_nid', type: 'varchar', length: 25, nullable: true })
  motherNid?: string | null;

  @Column({ name: 'mother_phone', type: 'varchar', length: 20, nullable: true })
  motherPhone?: string | null;

  @Column({ name: 'mother_occupation', type: 'varchar', length: 80, nullable: true })
  motherOccupation?: string | null;

  @Column({ name: 'local_guardian_name', type: 'varchar', length: 120, nullable: true })
  localGuardianName?: string | null;

  @Column({ name: 'local_guardian_relation', type: 'varchar', length: 50, nullable: true })
  localGuardianRelation?: string | null;

  @Column({ name: 'local_guardian_phone', type: 'varchar', length: 20, nullable: true })
  localGuardianPhone?: string | null;

  @Column({ name: 'local_guardian_nid', type: 'varchar', length: 25, nullable: true })
  localGuardianNid?: string | null;

  @Column({ name: 'present_address', type: 'text' })
  presentAddress!: string;

  @Column({ name: 'permanent_address', type: 'text', nullable: true })
  permanentAddress?: string | null;

  @Column({ name: 'upazila_thana', type: 'varchar', length: 80, nullable: true })
  upazilaThana?: string | null;

  @Column({ name: 'district', type: 'varchar', length: 80, nullable: true })
  district?: string | null;

  @Column({ name: 'is_zakat_eligible_family', type: 'boolean', default: false })
  isZakatEligibleFamily!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
