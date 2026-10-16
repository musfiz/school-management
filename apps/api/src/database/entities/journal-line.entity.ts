/** Sub-ledger type discriminator. */
export type SubledgerType = 'VENDOR' | 'EMPLOYEE' | 'STUDENT';

/** Allowed sub-ledger types. */
export const SUBLEDGER_TYPES: SubledgerType[] = ['VENDOR', 'EMPLOYEE', 'STUDENT'];

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
