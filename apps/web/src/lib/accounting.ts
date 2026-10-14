export interface Fund {
  id: string;
  fundCode: string;
  fundName: string;
  isRestricted: boolean;
  shariahCompliant: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type InstitutionType = "SCHOOL" | "COLLEGE" | "UNIVERSITY" | "MADRASA";

export const INSTITUTION_TYPES: InstitutionType[] = [
  "SCHOOL",
  "COLLEGE",
  "UNIVERSITY",
  "MADRASA",
];

export interface CostCenter {
  id: string;
  centerCode: string;
  centerName: string;
  institutionType: InstitutionType;
  parentId?: string | null;
  parent?: CostCenter | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "CONTRA_REVENUE"
  | "CONTRA_ASSET";

export const ACCOUNT_TYPES: AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
  "CONTRA_REVENUE",
  "CONTRA_ASSET",
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Fund Balance",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
  CONTRA_REVENUE: "Contra-Revenue",
  CONTRA_ASSET: "Contra-Asset",
};

export const NORMAL_BALANCE_BY_TYPE: Record<AccountType, "DR" | "CR"> = {
  ASSET: "DR",
  EXPENSE: "DR",
  CONTRA_REVENUE: "DR",
  LIABILITY: "CR",
  EQUITY: "CR",
  REVENUE: "CR",
  CONTRA_ASSET: "CR",
};

/** Contra accounts nest under their natural parent (netted on statements). */
export function isContraPair(parent: AccountType, child: AccountType): boolean {
  return (
    (parent === "REVENUE" && child === "CONTRA_REVENUE") ||
    (parent === "ASSET" && child === "CONTRA_ASSET")
  );
}

export interface ChartOfAccount {
  id: string;
  glCode: string;
  accountName: string;
  accountNameBn?: string | null;
  accountType: AccountType;
  normalBalance: "DR" | "CR";
  parentId?: string | null;
  parent?: ChartOfAccount | null;
  isControlAccount: boolean;
  isCashOrBank: boolean;
  defaultFundId?: string | null;
  defaultFund?: Fund | null;
  isActive: boolean;
  children?: AccountTreeNode[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountTreeNode extends ChartOfAccount {
  children: AccountTreeNode[];
}

export interface FiscalPeriod {
  id: string;
  periodName: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedByUserId?: number | null;
  closedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
