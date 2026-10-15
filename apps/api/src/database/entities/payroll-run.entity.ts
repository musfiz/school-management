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
import { Fund } from './fund.entity';
import { CostCenter } from './cost-center.entity';
import { JournalEntry } from './journal-entry.entity';
import { User } from './user.entity';
import { PayslipLine } from './payslip-line.entity';

export type PayrollRunStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'REVERSED';

export const PAYROLL_RUN_STATUSES: PayrollRunStatus[] = [
  'DRAFT',
  'APPROVED',
  'PAID',
  'REVERSED',
];

/**
 * Monthly salary run (Phase 6, plan §3 Phase 6.2).
 * Approval posts ONE journal for the whole run (sourceModule PAYROLL):
 *   Dr 51101 Basic Salary & Allowances (Institutional) = Σ institutional gross
 *   Dr 51104 Employer PF Matching                     = Σ employer PF
 *   Cr 22101 PF Liability        = Σ (employee PF + employer PF)
 *   Cr 21301 TDS (AIT) Payable  = Σ AIT
 *   Cr 11403 Staff Advances/Loans (EMPLOYEE sub-ledger) = Σ loans
 *   Cr 21102 Salaries Payable (EMPLOYEE sub-ledger)     = Σ net
 *
 * MPO ISOLATION: `mpoGovtTotal` is summed for payslip display and tax
 * reporting only — it NEVER appears in any journal leg, so government
 * EFT money never touches institutional cash/bank liability.
 */
@Entity('payroll_runs')
export class PayrollRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Sequential run number (PR-YYYY-MM-###). */
  @Column({ name: 'run_no', type: 'varchar', length: 30, unique: true })
  runNo!: string;

  /** Payroll month `YYYY-MM`. */
  @Column({ name: 'payroll_month', type: 'varchar', length: 7 })
  payrollMonth!: string;

  @Column({ name: 'pay_date', type: 'date' })
  payDate!: string;

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

  /** Informational only — government MPO EFT, never posted. */
  @Column({ name: 'mpo_govt_total', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  mpoGovtTotal!: string;

  @Column({ name: 'institutional_gross_total', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  institutionalGrossTotal!: string;

  @Column({ name: 'pf_employee_total', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  pfEmployeeTotal!: string;

  @Column({ name: 'pf_employer_total', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  pfEmployerTotal!: string;

  @Column({ name: 'ait_tds_total', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  aitTdsTotal!: string;

  @Column({ name: 'loan_deduction_total', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  loanDeductionTotal!: string;

  @Column({ name: 'net_payable_total', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  netPayableTotal!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: "'DRAFT'" })
  status!: PayrollRunStatus;

  @Column({ name: 'gl_journal_id', type: 'char', length: '36', nullable: true })
  glJournalId!: string | null;

  @ManyToOne(() => JournalEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'gl_journal_id' })
  glJournal!: JournalEntry | null;

  /** PAYMENT voucher that disbursed the run (full-pay only). */
  @Column({ name: 'payment_journal_id', type: 'char', length: '36', nullable: true })
  paymentJournalId!: string | null;

  @ManyToOne(() => JournalEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'payment_journal_id' })
  paymentJournal!: JournalEntry | null;

  @Column({ name: 'narration', type: 'varchar', length: 255, nullable: true })
  narration!: string | null;

  @Column({ name: 'created_by_user_id', type: 'char', length: '36', nullable: true })
  createdByUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: User | null;

  @OneToMany(() => PayslipLine, (l) => l.run)
  lines!: PayslipLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
