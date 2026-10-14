import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChartOfAccount } from './chart-of-account.entity';

export type CautionStatus = 'HELD' | 'ADJUSTED' | 'REFUNDED';

export const CAUTION_STATUSES: CautionStatus[] = ['HELD', 'ADJUSTED', 'REFUNDED'];

/**
 * Refundable caution / security deposit ledger (GL 21401/21402, Phase 3).
 * Held on admission, adjusted against dues or refunded on graduation —
 * never recognised as revenue.
 */
@Entity('student_caution_deposits')
export class StudentCautionDeposit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'char', length: '36' })
  studentId!: string;

  @Column({ name: 'gl_account_id', type: 'char', length: '36' })
  glAccountId!: string;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'gl_account_id' })
  glAccount?: ChartOfAccount;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  amount!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'HELD' })
  status!: CautionStatus;

  @Column({ name: 'receipt_journal_id', type: 'char', length: '36', nullable: true })
  receiptJournalId?: string | null;

  @Column({ name: 'settlement_journal_id', type: 'char', length: '36', nullable: true })
  settlementJournalId?: string | null;

  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true })
  remark?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
