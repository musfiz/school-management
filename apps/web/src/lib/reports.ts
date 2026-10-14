import type { AccountType, NormalBalance } from "./accounting";

export interface TrialBalanceRow {
  glAccountId: string;
  glCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  isCashOrBank: boolean;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
}

export interface TrialBalanceReport {
  period: { startDate: string; endDate: string };
  filters: { fundId?: string; costCenterId?: string };
  rows: TrialBalanceRow[];
  totals: {
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
    difference: string;
    isBalanced: boolean;
  };
}

export interface CashBankBalanceItem {
  glAccountId: string;
  glCode: string;
  accountName: string;
  balance: string;
}

export interface CashHeadItem {
  glCode: string;
  name: string;
  amount: string;
}

export interface ReceiptsPaymentsReport {
  period: { startDate: string; endDate: string };
  filters: { fundId?: string; costCenterId?: string };
  openingBalances: CashBankBalanceItem[];
  totalOpening: string;
  receipts: CashHeadItem[];
  totalReceipts: string;
  payments: CashHeadItem[];
  totalPayments: string;
  closingBalances: CashBankBalanceItem[];
  totalClosing: string;
  reconciliationDiscrepancy: string;
  isReconciled: boolean;
}

export interface IncomeExpenditureItem {
  glAccountId: string;
  glCode: string;
  accountName: string;
  amount: string;
}

export interface IncomeExpenditureReport {
  period: { startDate: string; endDate: string };
  filters: { fundId?: string; costCenterId?: string };
  revenues: IncomeExpenditureItem[];
  grossRevenue: string;
  contraRevenues: IncomeExpenditureItem[];
  totalContraRevenue: string;
  netOperatingRevenue: string;
  expenses: IncomeExpenditureItem[];
  totalExpense: string;
  netSurplusDeficit: string;
  isSurplus: boolean;
}

export interface BalanceSheetAccountItem {
  glAccountId: string;
  glCode: string;
  accountName: string;
  amount: string;
}

export interface BalanceSheetReport {
  asOfDate: string;
  filters: { fundId?: string };
  assets: {
    current: BalanceSheetAccountItem[];
    fixed: BalanceSheetAccountItem[];
    total: string;
  };
  liabilities: {
    current: BalanceSheetAccountItem[];
    longTerm: BalanceSheetAccountItem[];
    total: string;
  };
  fundBalance: {
    accounts: BalanceSheetAccountItem[];
    totalBeginningBalance: string;
    currentPeriodSurplusDeficit: string;
    totalFundBalance: string;
  };
  totalLiabilitiesAndEquity: string;
  discrepancy: string;
  isBalanced: boolean;
}

export interface DefaulterAgingItem {
  invoiceId: string;
  invoiceNo: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  billingPeriod: string;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  agingBucket: "0–30 days" | "31–60 days" | "61–90 days" | "90+ days";
  netAmount: string;
  lateFineAmount: string;
  paidAmount: string;
  dueBalance: string;
  status: string;
}

export interface DefaulterAgingReport {
  asOfDate: string;
  summary: {
    totalDefaulters: number;
    totalOutstanding: string;
    buckets: {
      "0–30 days": string;
      "31–60 days": string;
      "61–90 days": string;
      "90+ days": string;
    };
  };
  items: DefaulterAgingItem[];
}

export interface GeneralLedgerLine {
  lineId: string;
  voucherId: string;
  voucherNo: string;
  voucherType: string;
  transactionDate: string;
  narration: string;
  lineMemo?: string | null;
  fundCode?: string;
  costCenterCode?: string;
  subledgerType?: string;
  subledgerId?: string;
  debitAmount: string;
  creditAmount: string;
  runningBalance: string;
}

export interface GeneralLedgerReport {
  account: {
    id: string;
    glCode: string;
    accountName: string;
    accountType: string;
    normalBalance: string;
    isControlAccount: boolean;
    isCashOrBank: boolean;
  };
  period: { startDate: string; endDate: string };
  filters: { fundId?: string; costCenterId?: string };
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  lines: GeneralLedgerLine[];
}

/** Export tabular data to CSV download */
export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] == null ? "" : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
