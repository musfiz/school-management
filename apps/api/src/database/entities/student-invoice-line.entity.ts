import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StudentInvoice } from './student-invoice.entity';
import { FeeHead } from './fee-head.entity';
import { ChartOfAccount } from './chart-of-account.entity';
import { Fund } from './fund.entity';
import { CostCenter } from './cost-center.entity';
import { StudentWaiver } from './student-waiver.entity';

const money = (name: string, nullable = false): any => ({
  name,
  type: 'decimal',
  precision: 15,
  scale: 2,
  default: nullable ? undefined : '0.00',
  isNullable: nullable,
  transformer: {
    to: (v: string | number | null | undefined) => v ?? (nullable ? null : '0.00'),
    from: (v: string | null) => (v == null ? (nullable ? null : '0.00') : String(v)),
  },
});

/** One fee-head leg of an invoice: gross − waiver = net (Phase 3). */
@Entity('student_invoice_lines')
export class StudentInvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'invoice_id', type: 'char', length: '36' })
  invoiceId!: string;

  @ManyToOne(() => StudentInvoice, (inv) => inv.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: StudentInvoice;

  @Column({ name: 'fee_head_id', type: 'char', length: '36' })
  feeHeadId!: string;

  @ManyToOne(() => FeeHead, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fee_head_id' })
  feeHead?: FeeHead;

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

  @Column({ name: 'credit_hours', type: 'decimal', precision: 8, scale: 2, default: '0.00' })
  creditHours!: string;

  @Column(money('gross_amount'))
  grossAmount!: string;

  @Column(money('waiver_amount'))
  waiverAmount!: string;

  @Column(money('net_amount'))
  netAmount!: string;

  @Column({ name: 'waiver_id', type: 'char', length: '36', nullable: true })
  waiverId?: string | null;

  @ManyToOne(() => StudentWaiver, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'waiver_id' })
  waiver?: StudentWaiver | null;

  @Column({ name: 'line_memo', type: 'varchar', length: 255, nullable: true })
  lineMemo?: string | null;
}
