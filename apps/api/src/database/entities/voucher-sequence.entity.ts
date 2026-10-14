import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Last issued sequence number per (calendar year × voucher type).
 * The posting service takes a pessimistic write lock on this row inside
 * its transaction, so concurrent voucher creation can never collide
 * (Phase 2 `VoucherSequenceService`).
 */
@Entity('voucher_sequences')
@Unique('uq_voucher_sequence_year_type', ['fiscalYear', 'voucherType'])
export class VoucherSequence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'fiscal_year', type: 'varchar', length: 9 })
  fiscalYear!: string;

  @Column({ name: 'voucher_type', type: 'varchar', length: 20 })
  voucherType!: string;

  @Column({ name: 'last_number', type: 'int', default: 0 })
  lastNumber!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
