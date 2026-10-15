import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AdmissionSequence } from '../../database/entities/admission-sequence.entity';

/**
 * Phase 1 primitive — row-locked counters (Plan Phase 1, common/).
 * Every reservation runs SELECT … FOR UPDATE inside the caller's
 * transaction: concurrent admitters serialize on the scope row and never
 * share a number. Lost-insert race (two creators, same new scope) falls
 * back to the winner's row.
 */
@Injectable()
export class SequenceService {
  async next(manager: EntityManager, scope: string): Promise<number> {
    const repo = manager.getRepository(AdmissionSequence);
    const locked = () =>
      repo
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.scopeKey = :k', { k: scope })
        .getOne();
    let row = await locked();
    if (!row) {
      try {
        await repo.save(repo.create({ scopeKey: scope, lastNumber: 1 }));
        return 1;
      } catch (err) {
        // Lost the insert race (duplicate key) — take the winner's row. If the
        // row still isn't there the insert failed for a real reason (e.g. a
        // scope key too long for the column): surface that, don't mask it as
        // contention.
        row = await locked();
        if (!row) {
          throw new BadRequestException(
            `Sequence ${scope} could not be created: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    if (!row) throw new BadRequestException(`Sequence ${scope} is contended — retry`);
    row.lastNumber += 1;
    await repo.save(row);
    return row.lastNumber;
  }
}
