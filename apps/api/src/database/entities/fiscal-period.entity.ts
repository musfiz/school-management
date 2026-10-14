import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Fiscal-period master (Phase 1). Posting into a closed period is
 * rejected by the journal engine (Phase 2 period-lock rule).
 * Bangladesh academic/fiscal convention: July → June.
 */
@Entity('fiscal_periods')
export class FiscalPeriod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'period_name', type: 'varchar', length: 50 })
  periodName!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ name: 'is_closed', type: 'boolean', default: false })
  isClosed!: boolean;

  @Column({ name: 'closed_by_user_id', type: 'char', length: '36', nullable: true })
  closedByUserId?: string | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
