import type { ChartOfAccount } from "./accounting";
import type { StudentInvoice } from "./billing";

export type PaymentChannel =
  | "CASH"
  | "BANK_CHALLAN"
  | "BKASH"
  | "NAGAD"
  | "ROCKET"
  | "UPAY"
  | "SSLCOMMERZ"
  | "EKPAY";

export const PAYMENT_CHANNELS: PaymentChannel[] = [
  "CASH",
  "BANK_CHALLAN",
  "BKASH",
  "NAGAD",
  "ROCKET",
  "UPAY",
  "SSLCOMMERZ",
  "EKPAY",
];

export const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  CASH: "Cash (counter)",
  BANK_CHALLAN: "Bank challan / scroll",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  UPAY: "Upay",
  SSLCOMMERZ: "SSLCommerz",
  EKPAY: "EkPay",
};

export const MFS_CHANNELS: PaymentChannel[] = [
  "BKASH",
  "NAGAD",
  "ROCKET",
  "UPAY",
  "SSLCOMMERZ",
  "EKPAY",
];

export function isMfs(channel: PaymentChannel): boolean {
  return MFS_CHANNELS.includes(channel);
}

/** Counter default TDR % per channel (editable per receipt). */
export const DEFAULT_TDR_PERCENT: Record<PaymentChannel, number> = {
  CASH: 0,
  BANK_CHALLAN: 0,
  BKASH: 1.0,
  NAGAD: 0.8,
  ROCKET: 1.0,
  UPAY: 1.0,
  SSLCOMMERZ: 2.0,
  EKPAY: 1.0,
};

export type ReconciliationStatus = "COLLECTED" | "PENDING" | "SETTLED" | "REVERSED";

export interface AllocationLeg {
  label: string;
  glCode: string;
  fundCode: string;
  amount: string;
}

export interface PaymentCollection {
  id: string;
  moneyReceiptNo: string;
  studentId: string;
  invoiceId: string;
  invoice?: StudentInvoice | null;
  paymentChannel: PaymentChannel;
  gatewayTrxId?: string | null;
  collectedGrossAmount: string;
  gatewayTdrFee: string;
  netBankAmount: string;
  cashGlId: string;
  cashGl?: ChartOfAccount | null;
  reconciliationStatus: ReconciliationStatus;
  glJournalId?: string | null;
  settlementJournalId?: string | null;
  bankReference?: string | null;
  allocation?: string | null;
  remark?: string | null;
  createdAt?: string;
}

export interface DuesResponse {
  studentId: string;
  open: StudentInvoice[];
  all: StudentInvoice[];
  summary: { openCount: number; totalDue: string };
}

export function invoiceDue(inv: StudentInvoice): number {
  return (
    Math.round(
      (Number(inv.netAmount) + Number(inv.lateFineAmount) - Number(inv.paidAmount)) * 100,
    ) / 100
  );
}

export function tdrFor(channel: PaymentChannel, gross: number): number {
  if (!isMfs(channel) || !(gross > 0)) return 0;
  return Math.round(gross * (DEFAULT_TDR_PERCENT[channel] / 100) * 100) / 100;
}

export function parseAllocation(raw?: string | null): AllocationLeg[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
