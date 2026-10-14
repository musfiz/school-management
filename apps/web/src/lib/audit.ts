export interface AuditActor {
  id?: string;
  name: string;
  email?: string;
  role?: string;
  at?: string;
}

export interface VoucherAuditItem {
  id: string;
  voucherNo: string;
  voucherType: string;
  transactionDate: string;
  sourceModule: string;
  sourceReferenceId?: string | null;
  narration: string;
  status: string;
  totalAmount: string;
  maker: AuditActor;
  checker: AuditActor | null;
  approver: AuditActor | null;
  reversedEntryId?: string | null;
  isSeparationCompliant: boolean;
}

export interface ReversalRegistryItem {
  reversalVoucherId: string;
  reversalVoucherNo: string;
  reversalDate: string;
  reversalReason: string;
  reverser: AuditActor;
  originalVoucher: {
    id: string;
    voucherNo: string;
    voucherType: string;
    transactionDate: string;
    narration: string;
    makerName: string;
    approverName: string;
  } | null;
}

export interface SourceModuleStat {
  key: string;
  name: string;
  description: string;
  voucherCount: number;
  totalVolume: string;
}

export interface AuditSummary {
  totalVouchers: number;
  approvedVouchers: number;
  draftVouchers: number;
  verifiedVouchers: number;
  reversedVouchers: number;
  reversalRate: string;
  totalApprovedVolume: string;
  separationOfDutiesViolations: number;
  complianceStatus: string;
}

export interface AuditActivityLog {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityReference?: string | null;
  actorId?: string | null;
  actor?: {
    id: string;
    name: string;
    email?: string;
    role?: string;
  } | null;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface VoucherAuditFilters {
  status?: string;
  voucherType?: string;
  sourceModule?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

export interface ActivityLogFilters {
  eventType?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export const VOUCHER_STATUSES = ["DRAFT", "VERIFIED", "APPROVED", "REVERSED"] as const;

export const VOUCHER_TYPES = ["JOURNAL", "RECEIVE", "PAYMENT", "CONTRA", "REVERSAL"] as const;

export const SOURCE_MODULES = [
  "MANUAL",
  "STUDENT_BILLING",
  "MFS_COLLECTION",
  "PROCUREMENT",
  "PAYROLL",
] as const;

export const SOURCE_MODULE_LABELS: Record<string, string> = {
  MANUAL: "Manual Journal",
  STUDENT_BILLING: "Student Billing",
  MFS_COLLECTION: "Fee Collection / MFS",
  PROCUREMENT: "Procurement / Vendor",
  PAYROLL: "Payroll / MPO",
};

export const AUDIT_EVENT_TYPES = [
  "VOUCHER_CREATED",
  "VOUCHER_VERIFIED",
  "VOUCHER_APPROVED",
  "VOUCHER_REVERSED",
  "INVOICE_GENERATED",
  "INVOICE_REVERSED",
  "PAYMENT_COLLECTED",
  "VENDOR_BILL_CREATED",
  "VENDOR_BILL_APPROVED",
  "TAX_CHALLAN_REMITTED",
  "PAYROLL_RUN_APPROVED",
  "PAYROLL_RUN_PAID",
  "MANUAL_AUDIT_ENTRY",
] as const;
