import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { SequenceService } from './sequence.service';

/**
 * Phase 1 — StudentIdGeneratorService (Plan Phase 1).
 * Custom formatted IDs via locked sequences, defaulting to the plan's
 * canonical examples: student `STD-26-00105`, family `FAM-2026-00891`,
 * application `APP-2026-00412`. The `[YEAR]-[CLASS_CODE]-[SEQ_4]` shape
 * is supported through the optional classCode segment (used once the
 * ID Format Builder settings land).
 */
@Injectable()
export class StudentIdGeneratorService {
  constructor(private readonly sequences: SequenceService) {}

  /** `STD-26-0001` — or `[YEAR]-[CLASS_CODE]-[SEQ_4]` when classCode given. */
  async nextStudentId(tx: Prisma.TransactionClient, year: string, classCode?: string): Promise<string> {
    const code = (classCode ?? '').trim().toUpperCase();
    const scope = code ? `STU:${year}:${code}` : `STU:${year}`;
    const seq = await this.sequences.next(tx, scope);
    return code
      ? `${year}-${code}-${String(seq).padStart(4, '0')}`
      : `STD-${year.slice(2)}-${String(seq).padStart(4, '0')}`;
  }

  /** `FAM-2026-00001`. */
  async nextFamilyCode(tx: Prisma.TransactionClient, year: string): Promise<string> {
    const seq = await this.sequences.next(tx, `FAM:${year}`);
    return `FAM-${year.slice(2)}-${String(seq).padStart(5, '0')}`;
  }

  /** `APP-2026-000001`. */
  async nextApplicationNo(tx: Prisma.TransactionClient, year: string): Promise<string> {
    const seq = await this.sequences.next(tx, `APP:${year}`);
    return `APP-${year}-${String(seq).padStart(6, '0')}`;
  }
}
