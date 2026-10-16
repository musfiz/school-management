import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Prisma as PrismaTypes } from '../generated/prisma/client';
import {
  REVERSAL_VOUCHER_PREFIX,
  VOUCHER_PREFIX_BY_TYPE,
  type VoucherType,
} from '../database/entities/journal-entry.entity';

/**
 * Collision-free sequential voucher numbers per (calendar year × type),
 * e.g. `JV-2026-000001`, `MR-2026-000001` (Phase 2, plan §3.2.1).
 *
 * MUST be called inside the caller's transaction: takes a pessimistic
 * write lock (`FOR UPDATE`) on the counter row so two concurrent
 * postings can never receive the same number.
 *
 * AD-P7: the TypeORM `EntityManager` is now a `Prisma.TransactionClient`.
 * The lock and the read are a single `SELECT … FOR UPDATE` (a *current*
 * read) so the counter is never taken from a REPEATABLE READ snapshot.
 */
@Injectable()
export class VoucherSequenceService {
  private prefixFor(type: VoucherType): string {
    if (type === 'REVERSAL') return REVERSAL_VOUCHER_PREFIX;
    return VOUCHER_PREFIX_BY_TYPE[type];
  }

  async nextVoucherNo(
    tx: PrismaTypes.TransactionClient,
    voucherType: VoucherType,
    transactionDate: string,
  ): Promise<string> {
    const fiscalYear = String(new Date(transactionDate).getFullYear());
    if (fiscalYear === 'NaN') {
      throw new Error(`Cannot derive fiscal year from "${transactionDate}"`);
    }

    const locked = () =>
      tx.$queryRaw<{ last_number: number }[]>(Prisma.sql`
        SELECT last_number FROM voucher_sequences
        WHERE fiscal_year = ${fiscalYear} AND voucher_type = ${voucherType}
        FOR UPDATE
      `);
    const row = (await locked())[0];

    let lastNumber: number;
    if (!row) {
      lastNumber = 1;
      await tx.voucherSequences.create({
        data: { fiscalYear, voucherType, lastNumber },
      });
    } else {
      lastNumber = row.last_number + 1;
      await tx.voucherSequences.update({
        where: { fiscalYear_voucherType: { fiscalYear, voucherType } },
        data: { lastNumber },
      });
    }

    const padded = String(lastNumber).padStart(6, '0');
    return `${this.prefixFor(voucherType)}-${fiscalYear}-${padded}`;
  }
}
