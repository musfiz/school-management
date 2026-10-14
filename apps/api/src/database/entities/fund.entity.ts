import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Fund master (Phase 1). Strict fund segregation per
 * docs/accounting_architecture_spec.md §1.1 — e.g. '01' General
 * (unrestricted) vs '02' Lillah/Zakat (restricted, shariah-compliant).
 */
@Entity('funds')
export class Fund {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'fund_code', type: 'varchar', length: 10, unique: true })
  fundCode!: string;

  @Column({ name: 'fund_name', type: 'varchar', length: 100 })
  fundName!: string;

  @Column({ name: 'is_restricted', type: 'boolean', default: false })
  isRestricted!: boolean;

  @Column({ name: 'shariah_compliant', type: 'boolean', default: false })
  shariahCompliant!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
