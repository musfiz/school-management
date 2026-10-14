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
import { Fund } from './fund.entity';
import { CostCenter } from './cost-center.entity';

/**
 * Fee head master (Phase 3).
 * Each head maps to a REVENUE natural GL (41101..42103) — or a LIABILITY
 * GL (21401/21402) when `isCautionDeposit` is true. Gross → waiver → net
 * math from docs/AGENT_IMPLEMENTATION_PLAN.md Phase 3.
 */
@Entity('fee_heads')
export class FeeHead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'head_code', type: 'varchar', length: 30, unique: true })
  headCode!: string;

  @Column({ name: 'head_name', type: 'varchar', length: 150 })
  headName!: string;

  /** MONTHLY fixed | TERM fixed | CREDIT_HOUR (creditHours × perCreditRate) | ONE_TIME */
  @Column({ name: 'billing_type', type: 'varchar', length: 20, default: 'MONTHLY' })
  billingType!: 'MONTHLY' | 'TERM' | 'CREDIT_HOUR' | 'ONE_TIME';

  @Column({
    name: 'default_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  defaultAmount!: string;

  @Column({
    name: 'per_credit_rate',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  perCreditRate!: string;

  @Column({ name: 'revenue_gl_id', type: 'char', length: '36' })
  revenueGlId!: string;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'revenue_gl_id' })
  revenueGl?: ChartOfAccount;

  @Column({ name: 'fund_id', type: 'char', length: '36', nullable: true })
  fundId?: string | null;

  @ManyToOne(() => Fund, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'fund_id' })
  fund?: Fund | null;

  @Column({ name: 'cost_center_id', type: 'char', length: '36', nullable: true })
  costCenterId?: string | null;

  @ManyToOne(() => CostCenter, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'cost_center_id' })
  costCenter?: CostCenter | null;

  /** True → posts to 21401/21402 liability instead of revenue. */
  @Column({ name: 'is_caution_deposit', type: 'boolean', default: false })
  isCautionDeposit!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
