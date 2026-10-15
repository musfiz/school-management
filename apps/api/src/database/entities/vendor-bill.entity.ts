import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';
import { ChartOfAccount } from './chart-of-account.entity';
import { Fund } from './fund.entity';
import { CostCenter } from './cost-center.entity';
import { JournalEntry } from './journal-entry.entity';
import { User } from './user.entity';

export type VendorBillStatus = 'DRAFT' | 'APPROVED' | 'PARTIAL' | 'PAID' | 'REVERSED';

export const VENDOR_BILL_STATUSES: VendorBillStatus[] = [
  'DRAFT',
  'APPROVED',
  'PARTIAL',
  'PAID',
  'REVERSED',
];

/**
 * Supplier bill with NBR withholding (Phase 5, plan §3 Phase 5.2).
 * One row = one supplier invoice against ONE expense/asset GL.
 *
 * Approval posts (single fund, fund isolation holds trivially):
 *   Dr 5xxxx Expense (or 121xx Asset)            = gross
 *   Cr 21101 AP – Vendor (VENDOR sub-ledger)     = net payable
 *   Cr 21302 TDS Payable – Suppliers            = tds
 *   Cr 21304 VDS Payable to Govt Treasury       = vds
 *
 * `mushak63Received` records whether the supplier furnished a Mushak 6.3
 * VAT challan — audit evidence only; the accountant still sets the VDS
 * rate explicitly (0 when the 6.3 shifts liability to the supplier).
 */
@Entity('vendor_bills')
export class VendorBill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Sequential bill number (VB-YYYY-XXXXXX). */
  @Column({ name: 'bill_no', type: 'varchar', length: 30, unique: true })
  billNo!: string;

  @Column({ name: 'vendor_id', type: 'char', length: '36' })
  vendorId!: string;

  @ManyToOne(() => Vendor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendor_id' })
  vendor!: Vendor;

  /** Debit leg: 5xxxx expense or 121xx fixed-asset GL. */
  @Column({ name: 'expense_gl_id', type: 'char', length: '36' })
  expenseGlId!: string;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expense_gl_id' })
  expenseGl!: ChartOfAccount;

  @Column({ name: 'fund_id', type: 'char', length: '36' })
  fundId!: string;

  @ManyToOne(() => Fund, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fund_id' })
  fund!: Fund;

  @Column({ name: 'cost_center_id', type: 'char', length: '36', nullable: true })
  costCenterId!: string | null;

  @ManyToOne(() => CostCenter, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'cost_center_id' })
  costCenter!: CostCenter | null;

  @Column({ name: 'bill_date', type: 'date' })
  billDate!: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  /** Supplier's own invoice reference (paper trail). */
  @Column({ name: 'supplier_invoice_no', type: 'varchar', length: 60, nullable: true })
  supplierInvoiceNo!: string | null;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2 })
  grossAmount!: string;

  @Column({ name: 'tds_rate', type: 'decimal', precision: 5, scale: 2, default: "'0.00'" })
  tdsRate!: string;

  @Column({ name: 'tds_amount', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  tdsAmount!: string;

  @Column({ name: 'vds_rate', type: 'decimal', precision: 5, scale: 2, default: "'0.00'" })
  vdsRate!: string;

  @Column({ name: 'vds_amount', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  vdsAmount!: string;

  @Column({ name: 'net_payable', type: 'decimal', precision: 15, scale: 2 })
  netPayable!: string;

  /** Paid to vendor so far (via pay endpoint). */
  @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  paidAmount!: string;

  /** Withheld tax already deposited to Treasury via challan. */
  @Column({ name: 'tds_remitted_amount', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  tdsRemittedAmount!: string;

  @Column({ name: 'vds_remitted_amount', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  vdsRemittedAmount!: string;

  @Column({ name: 'mushak_63_received', type: 'boolean', default: false })
  mushak63Received!: boolean;

  @Column({ name: 'status', type: 'varchar', length: 20, default: "'DRAFT'" })
  status!: VendorBillStatus;

  @Column({ name: 'gl_journal_id', type: 'char', length: '36', nullable: true })
  glJournalId!: string | null;

  @ManyToOne(() => JournalEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'gl_journal_id' })
  glJournal!: JournalEntry | null;

  @Column({ name: 'narration', type: 'varchar', length: 255, nullable: true })
  narration!: string | null;

  @Column({ name: 'created_by_user_id', type: 'char', length: '36', nullable: true })
  createdByUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
