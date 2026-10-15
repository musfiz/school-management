import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Supplier / contractor master (Phase 5, plan §3 Phase 5.1).
 * Journal sub-ledger on 21101 AP uses `subledgerType = 'VENDOR'`
 * with `subledgerId = vendors.id` — no FK from journal lines,
 * so vendors stay deletable only while unused (service guards).
 */
@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Optional vendor code (e.g. `VND-0007`). Unique when provided. */
  @Column({ name: 'vendor_code', type: 'varchar', length: 20, nullable: true, unique: true })
  vendorCode!: string | null;

  @Column({ name: 'vendor_name', type: 'varchar', length: 150 })
  vendorName!: string;

  /** NBR Business Identification Number (9 digits) — optional. */
  @Column({ name: 'bin_no', type: 'varchar', length: 20, nullable: true })
  binNo!: string | null;

  @Column({ name: 'trade_license_no', type: 'varchar', length: 60, nullable: true })
  tradeLicenseNo!: string | null;

  @Column({ name: 'contact_person', type: 'varchar', length: 120, nullable: true })
  contactPerson!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: '30', nullable: true })
  contactPhone!: string | null;

  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
