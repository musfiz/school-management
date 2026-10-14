/** Phase 5 — procurement, vendor payables & NBR withholding types + calculator. */

export interface Vendor {
  id: string;
  vendorCode: string | null;
  vendorName: string;
  binNo: string | null;
  tradeLicenseNo: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
}

export type VendorBillStatus = "DRAFT" | "APPROVED" | "PARTIAL" | "PAID" | "REVERSED";

export interface VendorBill {
  id: string;
  billNo: string;
  vendorId: string;
  vendor?: Vendor | null;
  expenseGlId: string;
  expenseGl?: { id: string; glCode: string; accountName: string } | null;
  fundId: string;
  fund?: { id: string; fundCode: string; fundName: string } | null;
  costCenterId: string | null;
  billDate: string;
  dueDate: string | null;
  supplierInvoiceNo: string | null;
  grossAmount: string;
  tdsRate: string;
  tdsAmount: string;
  vdsRate: string;
  vdsAmount: string;
  netPayable: string;
  paidAmount: string;
  tdsRemittedAmount: string;
  vdsRemittedAmount: string;
  mushak63Received: boolean;
  status: VendorBillStatus;
  glJournalId: string | null;
  glJournal?: { id: string; voucherNo: string } | null;
  narration: string | null;
}

export type WithheldTaxType = "TDS" | "VDS";

export interface PendingTaxLeg {
  billId: string;
  billNo: string;
  vendorName: string;
  billDate: string;
  taxType: WithheldTaxType;
  rate: string;
  deducted: string;
  remitted: string;
  pending: string;
}

export interface TaxChallanItem {
  id: string;
  challanId: string;
  vendorBillId: string;
  vendorBill?: { id: string; billNo: string } | null;
  taxType: WithheldTaxType;
  amount: string;
}

export interface TaxChallan {
  id: string;
  challanNo: string;
  challanDate: string;
  bankGlId: string;
  bankGl?: { id: string; glCode: string; accountName: string } | null;
  depositBankName: string | null;
  totalAmount: string;
  glJournalId: string | null;
  glJournal?: { id: string; voucherNo: string } | null;
  status: string;
  items: TaxChallanItem[];
}

/** Round-half-up to 2dp (matches the API's decimal.js ROUND_HALF_UP). */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Client preview of the NBR engine — Gross → TDS → VDS → Net.
 * Mirrors `VendorBillService.createBill` exactly.
 */
export function calcBill(gross: number, tdsRate: number, vdsRate: number) {
  const tds = r2((gross * tdsRate) / 100);
  const vds = r2((gross * vdsRate) / 100);
  const net = r2(gross - tds - vds);
  return { tds, vds, net };
}

export const billOutstanding = (b: VendorBill) => r2(Number(b.netPayable) - Number(b.paidAmount));
export const billPendingTds = (b: VendorBill) => r2(Number(b.tdsAmount) - Number(b.tdsRemittedAmount));
export const billPendingVds = (b: VendorBill) => r2(Number(b.vdsAmount) - Number(b.vdsRemittedAmount));
