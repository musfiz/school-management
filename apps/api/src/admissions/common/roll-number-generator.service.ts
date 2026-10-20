import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { SequenceService } from './sequence.service';

/**
 * Phase 1 — RollNumberGeneratorService (Plan Phase 1).
 * Next sequential `class_roll_no` within
 * (academic_session_id, class_or_dept_id, section_or_batch_id), reserved
 * under FOR UPDATE so two officers admitting into the same section in the
 * same second never share a roll. The UNIQUE guard
 * uq_session_class_section_roll stays as backstop.
 */
@Injectable()
export class RollNumberGeneratorService {
  constructor(private readonly sequences: SequenceService) {}

  async nextRoll(
    tx: Prisma.TransactionClient,
    academicSessionId: string,
    classOrDeptId: string,
    sectionOrBatchId?: string | null,
  ): Promise<number> {
    const sectionKey = sectionOrBatchId ?? 'NOSEC';
    return this.sequences.next(tx, `ROLL:${academicSessionId}:${classOrDeptId}:${sectionKey}`);
  }

  /** Read-only preview of the next roll for a scope — no increment, no consume. */
  async peekRoll(
    tx: Prisma.TransactionClient,
    academicSessionId: string,
    classOrDeptId: string,
    sectionOrBatchId?: string | null,
  ): Promise<number> {
    const sectionKey = sectionOrBatchId ?? 'NOSEC';
    const row = (await tx.$queryRaw<{ scope_key: string; last_number: number }[]>(Prisma.sql`
      SELECT scope_key, last_number FROM admission_sequences
      WHERE scope_key = ${`ROLL:${academicSessionId}:${classOrDeptId}:${sectionKey}`} FOR UPDATE
    `))[0];
    return row ? row.last_number + 1 : 1;
  }
}
