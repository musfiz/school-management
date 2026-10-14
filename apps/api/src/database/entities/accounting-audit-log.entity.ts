import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type AccountingEventType =
  | 'VOUCHER_CREATED'
  | 'VOUCHER_VERIFIED'
  | 'VOUCHER_APPROVED'
  | 'VOUCHER_REVERSED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_REVERSED'
  | 'PAYMENT_COLLECTED'
  | 'VENDOR_BILL_CREATED'
  | 'VENDOR_BILL_APPROVED'
  | 'TAX_CHALLAN_REMITTED'
  | 'PAYROLL_RUN_APPROVED'
  | 'PAYROLL_RUN_PAID'
  | 'MANUAL_AUDIT_ENTRY';

/**
 * Immutable accounting audit event record (spec §1.7).
 * Tracks lifecycle events, approvals, reversals, and compliance actions.
 */
@Entity('accounting_audit_logs')
export class AccountingAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType!: AccountingEventType | string;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'char', length: '36' })
  entityId!: string;

  @Column({ name: 'entity_reference', type: 'varchar', length: 100, nullable: true })
  entityReference?: string | null;

  @Column({ name: 'actor_id', type: 'char', length: '36', nullable: true })
  actorId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: User | null;

  @Column({ name: 'action', type: 'varchar', length: 50 })
  action!: string;

  @Column({ name: 'details', type: 'text', nullable: true })
  details?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 50, nullable: true })
  ipAddress?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
