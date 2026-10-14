import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { VoucherSequence } from '../database/entities/voucher-sequence.entity';
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
 */
@Injectable()
export class VoucherSequenceService {
  constructor(
    @InjectRepository(VoucherSequence)
    private readonly seqRepo: Repository<VoucherSequence>,
  ) {}

  private prefixFor(type: VoucherType): string {
    if (type === 'REVERSAL') return REVERSAL_VOUCHER_PREFIX;
    return VOUCHER_PREFIX_BY_TYPE[type];
  }

  async nextVoucherNo(
    manager: EntityManager,
    voucherType: VoucherType,
    transactionDate: string,
  ): Promise<string> {
    const fiscalYear = String(new Date(transactionDate).getFullYear());
    if (fiscalYear === 'NaN') {
      throw new Error(`Cannot derive fiscal year from "${transactionDate}"`);
    }

    let seq = await manager
      .getRepository(VoucherSequence)
      .createQueryBuilder('seq')
      .setLock('pessimistic_write')
      .where('seq.fiscalYear = :fiscalYear', { fiscalYear })
      .andWhere('seq.voucherType = :voucherType', { voucherType })
      .getOne();

    if (!seq) {
      seq = manager.getRepository(VoucherSequence).create({
        fiscalYear,
        voucherType,
        lastNumber: 0,
      });
    }
    seq.lastNumber += 1;
    await manager.getRepository(VoucherSequence).save(seq);

    const padded = String(seq.lastNumber).padStart(6, '0');
    return `${this.prefixFor(voucherType)}-${fiscalYear}-${padded}`;
  }
}
