import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Permission } from './permission.entity';

/** Direct grant of a permission to a user. Composite PK (user_id, permission_id). */
@Entity('user_permissions')
export class UserPermission {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: '36' })
  user_id!: string;

  @PrimaryColumn({ name: 'permission_id', type: 'char', length: '36' })
  permission_id!: string;

  @Column({ name: 'assigned_by', type: 'char', length: '36', nullable: true })
  assigned_by?: string;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamp' })
  assigned_at!: Date;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission?: Permission;
}
