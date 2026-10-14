import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Institution types supported by the accounting segment model. */
export type InstitutionType = 'SCHOOL' | 'COLLEGE' | 'UNIVERSITY' | 'MADRASA';

export const INSTITUTION_TYPES: InstitutionType[] = [
  'SCHOOL',
  'COLLEGE',
  'UNIVERSITY',
  'MADRASA',
];

/**
 * Cost-center master (Phase 1). Second segment of the account code:
 * `[Fund] - [Cost Center] - [Natural GL]`, e.g. `01-102-41101`.
 */
@Entity('cost_centers')
export class CostCenter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'center_code', type: 'varchar', length: 15, unique: true })
  centerCode!: string;

  @Column({ name: 'center_name', type: 'varchar', length: 100 })
  centerName!: string;

  @Column({ name: 'institution_type', type: 'varchar', length: 20, default: 'SCHOOL' })
  institutionType!: InstitutionType;

  @Column({ name: 'parent_id', type: 'char', length: '36', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => CostCenter, (center) => center.children, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  parent?: CostCenter | null;

  @OneToMany(() => CostCenter, (center) => center.parent)
  children?: CostCenter[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
