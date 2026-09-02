import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/** A grouping label for permissions (e.g. "Website Management"). A permission
 *  may optionally belong to one module so the matrix can show a clear
 *  module → permissions parent/child hierarchy. */
@Entity('modules')
export class Module {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 100, unique: true })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;
}
