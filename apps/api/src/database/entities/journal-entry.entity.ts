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
import { FiscalPeriod } from './fiscal-period.entity';

/** Voucher families (spec §3). Stored as VARCHAR for MySQL→PG portability. */
export type VoucherType = 'JOURNAL' | 'RECEIVE' | 'PAYMENT' | 'CONTRA' | 'REVERSAL';

export const VOUCHER_TYPES: VoucherType[] = [
  'JOURNAL',
  'RECEIVE',
  'PAYMENT',
  'CONTRA',
  'REVERSAL',
];

/** Sequential-number prefix per voucher family (e.g. `JV-2026-000001`). */
export const VOUCHER_PREFIX_BY_TYPE: Record<Exclude<VoucherType, 'REVERSAL'>, string> = {
  JOURNAL: 'JV',
  RECEIVE: 'MR',
  PAYMENT: 'PV',
  CONTRA: 'CV',
};

export const REVERSAL_VOUCHER_PREFIX = 'RV';

/** Maker → Checker → Approver lifecycle (spec §1.7). */
export type JournalStatus = 'DRAFT' | 'VERIFIED' | 'APPROVED' | 'REVERSED';

export const JOURNAL_STATUSES: JournalStatus[] = [
  'DRAFT',
  'VERIFIED',
  'APPROVED',
  'REVERSED',
];

/** Originating module of a posting (spec §3 `source_module`). */
export type SourceModule =
  | 'MANUAL'
  | 'STUDENT_BILLING'
  | 'MFS_COLLECTION'
  | 'PAYROLL'
  | 'PROCUREMENT'
  | 'ADMISSION';

export const SOURCE_MODULES: SourceModule[] = [
  'MANUAL',
  'STUDENT_BILLING',
  'MFS_COLLECTION',
  'PAYROLL',
  'PROCUREMENT',
  'ADMISSION',
];

/**
 * Immutable double-entry voucher header (Phase 2).
 * APPROVED rows are never updated/deleted — corrections go through a
 * linked REVERSAL entry (`reversedEntryId`).
 */
@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'voucher_no', type: 'varchar', length: 30, unique: true })
  voucherNo!: string;

  @Column({ name: 'voucher_type', type: 'varchar', length: 20 })
  voucherType!: VoucherType;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate!: string;

  @Column({ name: 'fiscal_period_id', type: 'char', length: '36' })
  fiscalPeriodId!: string;

  @ManyToOne(() => FiscalPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fiscal_period_id' })
  fiscalPeriod?: FiscalPeriod;

  @Column({ name: 'source_module', type: 'varchar', length: 30, default: 'MANUAL' })
  sourceModule!: SourceModule;

  @Column({ name: 'source_reference_id', type: 'char', length: '36', nullable: true })
  sourceReferenceId?: string | null;

  @Column({ name: 'narration', type: 'text' })
  narration!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'DRAFT' })
  status!: JournalStatus;

  @Column({ name: 'reversed_entry_id', type: 'char', length: '36', nullable: true })
  reversedEntryId?: string | null;

  @ManyToOne(() => JournalEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'reversed_entry_id' })
  reversedEntry?: JournalEntry | null;

  /** Maker UUID (users.id). */
  @Column({ name: 'created_by_user_id', type: 'char', length: '36' })
  createdByUserId!: string;

  /** Checker UUID — set on verify. */
  @Column({ name: 'verified_by_user_id', type: 'char', length: '36', nullable: true })
  verifiedByUserId?: string | null;

  /** Approver UUID — set on approve/reverse. */
  @Column({ name: 'approved_by_user_id', type: 'char', length: '36', nullable: true })
  approvedByUserId?: string | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date | null;

  @OneToMany('JournalLine', 'entry', { cascade: false })
  lines?: import('./journal-line.entity').JournalLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
