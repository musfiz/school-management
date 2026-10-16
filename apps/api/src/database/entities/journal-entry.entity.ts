/** Journal entry row (wire shape — mirrors Prisma `JournalEntries`). */
export interface JournalEntry {
  id: string;
  voucherNo: string;
  voucherType: string;
  transactionDate: Date;
  fiscalPeriodId: string;
  sourceModule: string;
  sourceReferenceId?: string | null;
  narration: string;
  status: string;
  reversedEntryId?: string | null;
  createdByUserId: string;
  verifiedByUserId?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Prefix for reversal voucher numbers. */
export const REVERSAL_VOUCHER_PREFIX = 'RV';

/** Voucher type discriminator. */
export type VoucherType = 'JOURNAL' | 'RECEIVE' | 'PAYMENT' | 'CONTRA' | 'REVERSAL';

/** Voucher number prefix per type. */
export const VOUCHER_PREFIX_BY_TYPE: Record<VoucherType, string> = {
  JOURNAL: 'JV',
  RECEIVE: 'MR',
  PAYMENT: 'PV',
  CONTRA: 'CV',
  REVERSAL: 'RV',
};

/** All voucher types (for @IsIn validation). */
export const VOUCHER_TYPES: VoucherType[] = ['JOURNAL', 'RECEIVE', 'PAYMENT', 'CONTRA', 'REVERSAL'];

/** Source module for a voucher. */
export type SourceModule = 'MANUAL' | 'STUDENT_BILLING' | 'MFS_COLLECTION' | 'PROCUREMENT' | 'PAYROLL' | 'ADMISSION';

/** Allowed source modules. */
export const SOURCE_MODULES: SourceModule[] = ['MANUAL', 'STUDENT_BILLING', 'MFS_COLLECTION', 'PROCUREMENT', 'PAYROLL', 'ADMISSION'];

/** Journal line row (wire shape — mirrors Prisma `JournalLines`). */
export interface JournalLine {
  id: string;
  journalEntryId: string;
  glAccountId: string;
  fundId: string;
  costCenterId?: string | null;
  subledgerType?: string | null;
  subledgerId?: string | null;
  debitAmount: string;
  creditAmount: string;
  lineMemo?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
