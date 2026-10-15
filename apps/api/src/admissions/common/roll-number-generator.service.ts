import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
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
    manager: EntityManager,
    academicSessionId: string,
    classOrDeptId: string,
    sectionOrBatchId?: string | null,
  ): Promise<number> {
    const sectionKey = sectionOrBatchId ?? 'NOSEC';
    return this.sequences.next(
      manager,
      `ROLL:${academicSessionId}:${classOrDeptId}:${sectionKey}`,
    );
  }
}
