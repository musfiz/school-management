import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { FiscalPeriod } from './fiscal-period.entity';
import { JournalEntry } from './journal-entry.entity';

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'REVERSED';

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'UNPAID',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'REVERSED',
];

/**
 * Accrual student invoice header (Phase 3).
 * Unique (student_id, billing_period) blocks duplicate billing for the
 * same month/term. Money columns are DECIMAL(15,2); net = gross − waiver.
 */
@Entity('student_invoices')
@Unique('uq_invoice_student_period', ['studentId', 'billingPeriod'])
export class StudentInvoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'invoice_no', type: 'varchar', length: 30, unique: true })
  invoiceNo!: string;

  /** Polymorphic STUDENT sub-ledger UUID (users.id until People phase). */
  @Column({ name: 'student_id', type: 'char', length: '36' })
  studentId!: string;

  /** e.g. '2026-10' (monthly) or 'TERM-2026-H1' — unique per student. */
  @Column({ name: 'billing_period', type: 'varchar', length: 30 })
  billingPeriod!: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'UNPAID' })
  status!: InvoiceStatus;

  @Column({
    name: 'gross_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  grossAmount!: string;

  @Column({
    name: 'waiver_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  waiverAmount!: string;

  @Column({
    name: 'net_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  netAmount!: string;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  paidAmount!: string;

  @Column({
    name: 'late_fine_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  lateFineAmount!: string;

  @Column({ name: 'fiscal_period_id', type: 'char', length: '36' })
  fiscalPeriodId!: string;

  @ManyToOne(() => FiscalPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fiscal_period_id' })
  fiscalPeriod?: FiscalPeriod;

  /** Auto-posted accrual journal (source_module = STUDENT_BILLING). */
  @Column({ name: 'journal_entry_id', type: 'char', length: '36', nullable: true })
  journalEntryId?: string | null;

  @ManyToOne(() => JournalEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry?: JournalEntry | null;

  @Column({ name: 'cost_center_id', type: 'char', length: '36', nullable: true })
  costCenterId?: string | null;

  @Column({ name: 'created_by_user_id', type: 'char', length: '36', nullable: true })
  createdByUserId?: string | null;

  @Column({ name: 'narration', type: 'varchar', length: 255, nullable: true })
  narration?: string | null;

  @OneToMany('StudentInvoiceLine', 'invoice', { cascade: false })
  lines?: import('./student-invoice-line.entity').StudentInvoiceLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
