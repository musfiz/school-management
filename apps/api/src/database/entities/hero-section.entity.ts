import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** Singleton row (id is always 1) for the homepage Hero section settings */
@Entity('hero_sections')
export class HeroSection {
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  @Column({ name: 'admission_year', type: 'varchar', length: 50, nullable: true })
  admissionYear?: string | null;

  @Column({ name: 'tagline_1', type: 'varchar', length: 255, nullable: true })
  tagline1?: string | null;

  @Column({ name: 'tagline_1_bn', type: 'varchar', length: 255, nullable: true })
  tagline1Bn?: string | null;

  @Column({ name: 'tagline_2', type: 'varchar', length: 255, nullable: true })
  tagline2?: string | null;

  @Column({ name: 'tagline_2_bn', type: 'varchar', length: 255, nullable: true })
  tagline2Bn?: string | null;

  @Column({ name: 'tagline_3', type: 'varchar', length: 255, nullable: true })
  tagline3?: string | null;

  @Column({ name: 'tagline_3_bn', type: 'varchar', length: 255, nullable: true })
  tagline3Bn?: string | null;

  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription?: string | null;

  @Column({ name: 'short_description_bn', type: 'text', nullable: true })
  shortDescriptionBn?: string | null;

  @Column({ name: 'show_apply_button', type: 'boolean', default: true })
  showApplyButton!: boolean;

  @Column({ name: 'institute_open_info', type: 'varchar', length: 255, nullable: true })
  instituteOpenInfo?: string | null;

  @Column({ name: 'institute_open_info_bn', type: 'varchar', length: 255, nullable: true })
  instituteOpenInfoBn?: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}
