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
