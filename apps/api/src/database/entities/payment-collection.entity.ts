import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { StudentInvoice } from './student-invoice.entity';
import { ChartOfAccount } from './chart-of-account.entity';
import { Fund } from './fund.entity';

/** Counter / bank / MFS channels (plan Phase 4). */
export type PaymentChannel =
  | 'CASH'
  | 'BANK_CHALLAN'
  | 'BKASH'
  | 'NAGAD'
  | 'ROCKET'
  | 'UPAY'
  | 'SSLCOMMERZ'
  | 'EKPAY';

export const PAYMENT_CHANNELS: PaymentChannel[] = [
  'CASH',
  'BANK_CHALLAN',
  'BKASH',
  'NAGAD',
  'ROCKET',
  'UPAY',
  'SSLCOMMERZ',
  'EKPAY',
];

/** Gateways that settle via a clearing account before hitting the bank. */
export const MFS_CHANNELS: PaymentChannel[] = [
  'BKASH',
  'NAGAD',
  'ROCKET',
  'UPAY',
  'SSLCOMMERZ',
  'EKPAY',
];

/** Clearing GL per MFS channel (spec §2 seed list). */
export const CLEARING_GL_BY_CHANNEL: Partial<Record<PaymentChannel, string>> = {
  BKASH: '11301',
  NAGAD: '11302',
  ROCKET: '11302',
  UPAY: '11303',
  SSLCOMMERZ: '11303',
  EKPAY: '11303',
};

/** Default TDR % per channel (editable per receipt at the counter). */
export const DEFAULT_TDR_PERCENT: Record<PaymentChannel, number> = {
  CASH: 0,
  BANK_CHALLAN: 0,
  BKASH: 1.0,
  NAGAD: 0.8,
  ROCKET: 1.0,
  UPAY: 1.0,
  SSLCOMMERZ: 2.0,
  EKPAY: 1.0,
};

export type ReconciliationStatus = 'COLLECTED' | 'PENDING' | 'SETTLED' | 'REVERSED';

export const RECONCILIATION_STATUSES: ReconciliationStatus[] = [
  'COLLECTED',
  'PENDING',
  'SETTLED',
  'REVERSED',
];

/**
 * Fee collection receipt (Phase 4, plan §3 Phase 4.1).
 * One row = one money receipt (MR-YYYY-XXXXXX) against ONE invoice.
 * The POS cart posts one receipt per selected invoice so every MR maps
 * to exactly one RECEIVE voucher and one AR credit trail.
 *
 * Cash/bank: Dr Cash/Bank (cashGl) / Cr 11401 AR (gross, per-fund split).
 * MFS:       Dr 1130x Clearing (net) + Dr 54103 TDR / Cr 11401 AR (gross).
 * Settlement posts a separate CONTRA voucher (Dr 11201 / Cr 1130x).
 */
@Entity('payment_collections')
@Unique('uq_collection_gateway_trx', ['gatewayTrxId'])
export class PaymentCollection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Sequential money receipt number (MR-YYYY-XXXXXX, RECEIVE family). */
  @Column({ name: 'money_receipt_no', type: 'varchar', length: 30, unique: true })
  moneyReceiptNo!: string;

  /** Polymorphic STUDENT sub-ledger UUID (users.id until People phase). */
  @Column({ name: 'student_id', type: 'char', length: '36' })
  studentId!: string;

  @Column({ name: 'invoice_id', type: 'char', length: '36' })
  invoiceId!: string;

  @ManyToOne(() => StudentInvoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: StudentInvoice;

  @Column({ name: 'payment_channel', type: 'varchar', length: 20 })
  paymentChannel!: PaymentChannel;

  /**
   * Gateway transaction id (bKash trxID / Nagad reference / SSLCommerz
   * tran_id). Unique + nullable; idempotency key for webhook replays
   * (plan Phase 4 acceptance: same payload twice = one receipt).
   */
  @Column({ name: 'gateway_trx_id', type: 'varchar', length: 80, nullable: true })
  gatewayTrxId?: string | null;

  /** Gross amount credited to the student ledger (Dr AR side). */
  @Column({
    name: 'collected_gross_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  collectedGrossAmount!: string;

  /** Gateway TDR commission (0 for cash/bank). */
  @Column({
    name: 'gateway_tdr_fee',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  gatewayTdrFee!: string;

  /** Net cash hitting the debit GL (gross − TDR). */
  @Column({
    name: 'net_bank_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  netBankAmount!: string;

  /** Debit-side GL that received the money (cash/bank or 1130x clearing). */
  @Column({ name: 'cash_gl_id', type: 'char', length: '36' })
  cashGlId!: string;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cash_gl_id' })
  cashGl?: ChartOfAccount;

  @Column({ name: 'fund_id', type: 'char', length: '36', nullable: true })
  fundId?: string | null;

  @ManyToOne(() => Fund, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'fund_id' })
  fund?: Fund | null;

  @Column({ name: 'reconciliation_status', type: 'varchar', length: 20, default: 'COLLECTED' })
  reconciliationStatus!: ReconciliationStatus;

  /** Auto-posted RECEIVE voucher (source_module = MFS_COLLECTION). */
  @Column({ name: 'gl_journal_id', type: 'char', length: '36', nullable: true })
  glJournalId?: string | null;

  @ManyToOne(() => JournalEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'gl_journal_id' })
  glJournal?: JournalEntry | null;

  /** CONTRA voucher settling clearing → mother bank (1130x → 11201). */
  @Column({ name: 'settlement_journal_id', type: 'char', length: '36', nullable: true })
  settlementJournalId?: string | null;

  /** Bank scroll / challan / settlement reference typed at the counter. */
  @Column({ name: 'bank_reference', type: 'varchar', length: 80, nullable: true })
  bankReference?: string | null;

  /**
   * Line-allocation snapshot: how the gross was spread across the
   * invoice (late-fine → tuition → other priority). JSON array of
   * { feeHeadCode, glCode, fundCode, amount }.
   */
  @Column({ name: 'allocation', type: 'text', nullable: true })
  allocation?: string | null;

  @Column({ name: 'collected_by_user_id', type: 'char', length: '36', nullable: true })
  collectedByUserId?: string | null;

  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true })
  remark?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
