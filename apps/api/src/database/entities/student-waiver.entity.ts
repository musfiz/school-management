import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChartOfAccount } from './chart-of-account.entity';
import { Fund } from './fund.entity';

/** Waiver families map 1:1 to contra-revenue GLs 41901–41904 (spec §2). */
export type WaiverType =
  | 'MERIT'
  | 'FREEDOM_FIGHTER'
  | 'SIBLING_STAFF_AID'
  | 'LILLAH_ZAKAT_ORPHAN';

export const WAIVER_TYPES: WaiverType[] = [
  'MERIT',
  'FREEDOM_FIGHTER',
  'SIBLING_STAFF_AID',
  'LILLAH_ZAKAT_ORPHAN',
];

/** Default contra GL per waiver type (overridable per row via contraGlId). */
export const WAIVER_DEFAULT_GL: Record<WaiverType, string> = {
  MERIT: '41901',
  FREEDOM_FIGHTER: '41902',
  SIBLING_STAFF_AID: '41903',
  LILLAH_ZAKAT_ORPHAN: '41904',
};

/**
 * Waiver / scholarship grant to one student (Phase 3).
 * `studentId` is a polymorphic sub-ledger UUID (users.id for now — the
 * dedicated Student profile table lands with the People phase). Percent
 * and fixed cap combine: waiver = min(gross × pct/100, fixedCap or ∞).
 */
@Entity('student_waivers')
export class StudentWaiver {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'char', length: '36' })
  studentId!: string;

  @Column({ name: 'waiver_type', type: 'varchar', length: 30 })
  waiverType!: WaiverType;

  @Column({
    name: 'percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (v: string | number | null | undefined) => v ?? '0.00',
      from: (v: string | null) => (v == null ? '0.00' : String(v)),
    },
  })
  percent!: string;

  /** Optional BDT cap; null = uncapped percentage. */
  @Column({
    name: 'fixed_cap_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: string | number | null | undefined) => v ?? null,
      from: (v: string | null) => (v == null ? null : String(v)),
    },
  })
  fixedCapAmount?: string | null;

  @Column({ name: 'contra_gl_id', type: 'char', length: '36', nullable: true })
  contraGlId?: string | null;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'contra_gl_id' })
  contraGl?: ChartOfAccount | null;

  @Column({ name: 'fund_id', type: 'char', length: '36', nullable: true })
  fundId?: string | null;

  @ManyToOne(() => Fund, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'fund_id' })
  fund?: Fund | null;

  @Column({ name: 'active_from', type: 'date', nullable: true })
  activeFrom?: string | null;

  @Column({ name: 'active_to', type: 'date', nullable: true })
  activeTo?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true })
  remark?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
