import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Gap-free sequence scopes (Plan Phase 1 generators).
 * `scopeKey` e.g. 'STU:2026' (student IDs), 'FAM:2026' (family codes),
 * 'APP:2026' (application numbers), 'ROLL:<session>:<class>:<section>'.
 * Reserved with SELECT … FOR UPDATE inside the admitting transaction —
 * concurrent admissions never collide.
 */
@Entity('admission_sequences')
export class AdmissionSequence {
  @PrimaryColumn({ name: 'scope_key', type: 'varchar', length: 160 })
  scopeKey!: string;

  @Column({ name: 'last_number', type: 'int', default: 0 })
  lastNumber!: number;
}
