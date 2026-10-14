import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Fund } from './fund.entity';
import { CostCenter } from './cost-center.entity';
import { JournalEntry } from './journal-entry.entity';
import { User } from './user.entity';

export type HonorariumStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'REVERSED';

export const HONORARIUM_STATUSES: HonorariumStatus[] = [
  'DRAFT',
  'APPROVED',
  'PAID',
  'REVERSED',
];

/**
 * Adjunct / guest-faculty / exam-remuneration bill (Phase 6.3).
 * Gross is built from workload counts × rates; NBR TDS (10–15%) is
 * withheld to 21303 and the net credited to 21103 on approval:
 *   Dr 51103 Honorarium Expense                    = gross
 *   Cr 21103 Honorarium Payable (EMPLOYEE ledger)  = net
 *   Cr 21303 TDS Payable – Adjunct/Exam           = tds
 */
@Entity('adjunct_honorarium_bills')
export class AdjunctHonorariumBill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Sequential bill number (AH-YYYY-XXXXXX). */
  @Column({ name: 'bill_no', type: 'varchar', length: 30, unique: true })
  billNo!: string;

  @Column({ name: 'adjunct_name', type: 'varchar', length: 150 })
  adjunctName!: string;

  @Column({ name: 'adjunct_id', type: 'char', length: '36', nullable: true })
  adjunctId!: string | null;

  /** Work month `YYYY-MM`. */
  @Column({ name: 'work_month', type: 'varchar', length: 7 })
  workMonth!: string;

  @Column({ name: 'classes_count', type: 'int', default: 0 })
  classesCount!: number;

  @Column({ name: 'scripts_count', type: 'int', default: 0 })
  scriptsCount!: number;

  @Column({ name: 'viva_count', type: 'int', default: 0 })
  vivaCount!: number;

  @Column({ name: 'rate_per_class', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  ratePerClass!: string;

  @Column({ name: 'rate_per_script', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  ratePerScript!: string;

  @Column({ name: 'rate_per_viva', type: 'decimal', precision: 15, scale: 2, default: "'0.00'" })
  ratePerViva!: string;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2 })
  grossAmount!: string;

  @Column({ name: 'tds_rate', type: 'decimal', precision: 5, scale: 2 })
  tdsRate!: string;

  @Column({ name: 'tds_amount', type: 'decimal', precision: 15, scale: 2 })
  tdsAmount!: string;

  @Column({ name: 'net_payable', type: 'decimal', precision: 15, scale: 2 })
  netPayable!: string;

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

  @Column({ name: 'status', type: 'varchar', length: 20, default: "'DRAFT'" })
  status!: HonorariumStatus;

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
