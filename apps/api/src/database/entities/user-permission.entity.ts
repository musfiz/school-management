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
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id!: number;

  @PrimaryColumn({ name: 'permission_id', type: 'int' })
  permission_id!: number;

  @Column({ name: 'assigned_by', type: 'int', nullable: true })
  assigned_by?: number;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamp' })
  assigned_at!: Date;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission?: Permission;
}
