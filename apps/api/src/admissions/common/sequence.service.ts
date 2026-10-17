import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { Prisma as PrismaTypes } from '../../generated/prisma/client';

/**
 * Phase 1 primitive — row-locked counters (Plan Phase 1, common/).
 * Every reservation runs SELECT … FOR UPDATE inside the caller's
 * transaction: concurrent admitters serialize on the scope row and never
 * share a number. Lost-insert race (two creators, same new scope) falls
 * back to the winner's row.
 *
 * AD-P7: the Prisma `TransactionClient` is used for transaction scoping. The
 * lock and the read are a single `SELECT … FOR UPDATE` (a *current* read), so
 * the counter is never taken from a REPEATABLE READ snapshot.
 */
@Injectable()
export class SequenceService {
  async next(tx: PrismaTypes.TransactionClient, scope: string): Promise<number> {
    const locked = () =>
      tx.$queryRaw<{ scope_key: string; last_number: number }[]>(Prisma.sql`
        SELECT scope_key, last_number FROM admission_sequences
        WHERE scope_key = ${scope} FOR UPDATE
      `);
    let row = (await locked())[0];
    if (!row) {
      try {
        await tx.admissionSequences.create({
          data: { scopeKey: scope, lastNumber: 1 },
        });
        return 1;
      } catch (err) {
        // Lost the insert race (duplicate key) — take the winner's row. If the
        // row still isn't there the insert failed for a real reason (e.g. a
        // scope key too long for the column): surface that, don't mask it as
        // contention.
        row = (await locked())[0];
        if (!row) {
          throw new BadRequestException(
            `Sequence ${scope} could not be created: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    if (!row) throw new BadRequestException(`Sequence ${scope} is contended — retry`);
    const lastNumber = row.last_number + 1;
    await tx.admissionSequences.update({
      where: { scopeKey: scope },
      data: { lastNumber },
    });
    return lastNumber;
  }
}
