import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Module } from './module.entity';

/** A capability that can be assigned to a user, e.g. "results.edit". Unique by
 *  name so it can be referenced across the system. Optionally belongs to a
 *  module so the matrix can show a module → permissions hierarchy. */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ name: 'module_id', type: 'int', nullable: true })
  module_id?: number | null;

  @ManyToOne(() => Module, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'module_id' })
  module?: Module | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;
}
