import type { ChartOfAccount, CostCenter, Fund } from "./accounting";

export type BillingType = "MONTHLY" | "TERM" | "CREDIT_HOUR" | "ONE_TIME";

export interface FeeHead {
  id: string;
  headCode: string;
  headName: string;
  billingType: BillingType;
  defaultAmount: string;
  perCreditRate: string;
  revenueGlId: string;
  revenueGl?: ChartOfAccount | null;
  fundId?: string | null;
  fund?: Fund | null;
  costCenterId?: string | null;
  costCenter?: CostCenter | null;
  isCautionDeposit: boolean;
  isActive: boolean;
}

export type WaiverType = "MERIT" | "FREEDOM_FIGHTER" | "SIBLING_STAFF_AID" | "LILLAH_ZAKAT_ORPHAN";

export const WAIVER_TYPES: WaiverType[] = ["MERIT", "FREEDOM_FIGHTER", "SIBLING_STAFF_AID", "LILLAH_ZAKAT_ORPHAN"];

export const WAIVER_LABELS: Record<WaiverType, string> = {
  MERIT: "Merit / CGPA (41901)",
  FREEDOM_FIGHTER: "Freedom Fighter Quota (41902)",
  SIBLING_STAFF_AID: "Sibling / Staff-Child / Aid (41903)",
  LILLAH_ZAKAT_ORPHAN: "Lillah / Orphan Boarding (41904, Fund 02)",
};

export interface StudentWaiver {
  id: string;
  studentId: string;
  waiverType: WaiverType;
  percent: string;
  fixedCapAmount?: string | null;
  contraGlId?: string | null;
  fundId?: string | null;
  activeFrom?: string | null;
  activeTo?: string | null;
  isActive: boolean;
  remark?: string | null;
}

export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "REVERSED";

export interface InvoiceLine {
  id: string;
  feeHeadId: string;
  feeHead?: FeeHead | null;
  glAccountId: string;
  glAccount?: ChartOfAccount | null;
  fundId: string;
  fund?: Fund | null;
  creditHours: string;
  grossAmount: string;
  waiverAmount: string;
  netAmount: string;
  waiverId?: string | null;
}

export interface StudentInvoice {
  id: string;
  invoiceNo: string;
  studentId: string;
  billingPeriod: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  grossAmount: string;
  waiverAmount: string;
  netAmount: string;
  paidAmount: string;
  lateFineAmount: string;
  journalEntryId?: string | null;
  lines?: InvoiceLine[];
}

export interface CautionDeposit {
  id: string;
  studentId: string;
  glAccountId: string;
  glAccount?: ChartOfAccount | null;
  amount: string;
  status: "HELD" | "ADJUSTED" | "REFUNDED";
  receiptJournalId?: string | null;
  settlementJournalId?: string | null;
  remark?: string | null;
}

export interface StudentLedger {
  studentId: string;
  invoices: StudentInvoice[];
  cautions: CautionDeposit[];
  summary: {
    gross: string;
    waiver: string;
    net: string;
    lateFine: string;
    paid: string;
    receivable: string;
    cautionHeld: string;
    openInvoices: number;
  };
}

export function dueOf(inv: StudentInvoice): number {
  return Math.round((Number(inv.netAmount) + Number(inv.lateFineAmount) - Number(inv.paidAmount)) * 100) / 100;
}

export function fmtMoney(n: number | string): string {
  return Number(n).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
