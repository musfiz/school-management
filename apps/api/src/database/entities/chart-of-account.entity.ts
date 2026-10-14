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

/** Natural-account categories of the 5-digit CoA (spec §2). */
export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'CONTRA_REVENUE'
  | 'CONTRA_ASSET';

export const ACCOUNT_TYPES: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'CONTRA_REVENUE',
  'CONTRA_ASSET',
];

export type NormalBalance = 'DR' | 'CR';

/** Canonical normal balance per account type. */
export const NORMAL_BALANCE_BY_TYPE: Record<AccountType, NormalBalance> = {
  ASSET: 'DR',
  EXPENSE: 'DR',
  CONTRA_REVENUE: 'DR',
  LIABILITY: 'CR',
  EQUITY: 'CR',
  REVENUE: 'CR',
  CONTRA_ASSET: 'CR',
};

/**
 * Natural GL master (Phase 1). Third segment of the account code.
 * `isControlAccount` lines (e.g. 11401 Student AR) require a sub-ledger
 * reference at posting time (Phase 2 enforcement).
 */
@Entity('chart_of_accounts')
export class ChartOfAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'gl_code', type: 'varchar', length: 20, unique: true })
  glCode!: string;

  @Column({ name: 'account_name', type: 'varchar', length: 150 })
  accountName!: string;

  @Column({ name: 'account_name_bn', type: 'varchar', length: 150, nullable: true })
  accountNameBn?: string | null;

  @Column({ name: 'account_type', type: 'varchar', length: 20 })
  accountType!: AccountType;

  @Column({ name: 'normal_balance', type: 'char', length: 2 })
  normalBalance!: NormalBalance;

  @Column({ name: 'parent_id', type: 'char', length: '36', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => ChartOfAccount, (account) => account.children, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  parent?: ChartOfAccount | null;

  @OneToMany(() => ChartOfAccount, (account) => account.parent)
  children?: ChartOfAccount[];

  @Column({ name: 'is_control_account', type: 'boolean', default: false })
  isControlAccount!: boolean;

  @Column({ name: 'is_cash_or_bank', type: 'boolean', default: false })
  isCashOrBank!: boolean;

  @Column({ name: 'default_fund_id', type: 'char', length: '36', nullable: true })
  defaultFundId?: string | null;

  @ManyToOne(() => Fund, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'default_fund_id' })
  defaultFund?: Fund | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
