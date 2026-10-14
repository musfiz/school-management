import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChartOfAccount } from './chart-of-account.entity';
import { JournalEntry } from './journal-entry.entity';
import { User } from './user.entity';
import { TaxChallanItem } from './tax-challan-item.entity';

export type TaxChallanStatus = 'POSTED' | 'REVERSED';

export const TAX_CHALLAN_STATUSES: TaxChallanStatus[] = ['POSTED', 'REVERSED'];

/**
 * NBR Treasury deposit (Phase 5, plan §3 Phase 5.3).
 * One row = one Bangladesh Bank / Sonali Bank Treasury challan that
 * batches withheld TDS (21302) / VDS (21304) legs off vendor bills.
 *
 * Remittance posts (PAYMENT):
 *   Dr 21302 TDS Payable / 21304 VDS Payable (per selected leg)
 *   Cr 11201 (or chosen) Commercial Bank Operating A/C = challan total
 */
@Entity('tax_challans')
export class TaxChallan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Bank-stamped Treasury challan number (unique — double deposit guard). */
  @Column({ name: 'challan_no', type: 'varchar', length: 60, unique: true })
  challanNo!: string;

  @Column({ name: 'challan_date', type: 'date' })
  challanDate!: string;

  /** Operating bank the deposit was paid from (usually 11201). */
  @Column({ name: 'bank_gl_id', type: 'char', length: '36' })
  bankGlId!: string;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bank_gl_id' })
  bankGl!: ChartOfAccount;

  /** Free text, e.g. `Sonali Bank, Court Station Branch`. */
  @Column({ name: 'deposit_bank_name', type: 'varchar', length: 120, nullable: true })
  depositBankName!: string | null;

  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2 })
  totalAmount!: string;

  @Column({ name: 'gl_journal_id', type: 'char', length: '36', nullable: true })
  glJournalId!: string | null;

  @ManyToOne(() => JournalEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'gl_journal_id' })
  glJournal!: JournalEntry | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: "'POSTED'" })
  status!: TaxChallanStatus;

  @Column({ name: 'created_by_user_id', type: 'char', length: '36', nullable: true })
  createdByUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: User | null;

  @OneToMany(() => TaxChallanItem, (i) => i.challan)
  items!: TaxChallanItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
