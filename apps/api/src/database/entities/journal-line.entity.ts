import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { ChartOfAccount } from './chart-of-account.entity';
import { Fund } from './fund.entity';
import { CostCenter } from './cost-center.entity';

/** Sub-ledger families attachable to control-account lines (spec §3). */
export type SubledgerType = 'STUDENT' | 'VENDOR' | 'EMPLOYEE' | 'DONOR';

export const SUBLEDGER_TYPES: SubledgerType[] = [
  'STUDENT',
  'VENDOR',
  'EMPLOYEE',
  'DONOR',
];

/**
 * One debit-or-credit leg of a journal entry (Phase 2).
 * Amounts are DECIMAL(15,2) — never float. Exactly one of
 * `debitAmount` / `creditAmount` must be positive per line.
 */
@Entity('journal_lines')
export class JournalLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'journal_entry_id', type: 'char', length: '36' })
  journalEntryId!: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_entry_id' })
  entry?: JournalEntry;

  @Column({ name: 'gl_account_id', type: 'char', length: '36' })
  glAccountId!: string;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'gl_account_id' })
  glAccount?: ChartOfAccount;

  @Column({ name: 'fund_id', type: 'char', length: '36' })
  fundId!: string;

  @ManyToOne(() => Fund, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fund_id' })
  fund?: Fund;

  @Column({ name: 'cost_center_id', type: 'char', length: '36', nullable: true })
  costCenterId?: string | null;

  @ManyToOne(() => CostCenter, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'cost_center_id' })
  costCenter?: CostCenter | null;

  @Column({ name: 'subledger_type', type: 'varchar', length: 30, nullable: true })
  subledgerType?: SubledgerType | null;

  @Column({ name: 'subledger_id', type: 'char', length: '36', nullable: true })
  subledgerId?: string | null;

  @Column({
    name: 'debit_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  debitAmount!: string;

  @Column({
    name: 'credit_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  creditAmount!: string;

  @Column({ name: 'line_memo', type: 'varchar', length: 255, nullable: true })
  lineMemo?: string | null;
}
