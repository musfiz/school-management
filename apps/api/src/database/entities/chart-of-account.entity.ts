/** Account types used in the chart of accounts. */
export const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'CONTRA_ASSET',
  'CONTRA_REVENUE',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Normal balance side for an account type. */
export type NormalBalance = 'DR' | 'CR';

export const NORMAL_BALANCE_BY_TYPE: Record<AccountType, NormalBalance> = {
  ASSET: 'DR',
  LIABILITY: 'CR',
  EQUITY: 'CR',
  REVENUE: 'CR',
  EXPENSE: 'DR',
  CONTRA_ASSET: 'CR',
  CONTRA_REVENUE: 'DR',
};

/** Chart of accounts row (wire shape — mirrors Prisma `ChartOfAccounts`). */
export interface ChartOfAccount {
  id: string;
  glCode: string;
  accountName: string;
  accountNameBn?: string | null;
  accountType: string;
  normalBalance: string;
  parentId?: string | null;
  isControlAccount: boolean;
  isCashOrBank: boolean;
  defaultFundId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
