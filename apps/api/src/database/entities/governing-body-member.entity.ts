import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** A single governing body member — shown on the public "Governing Body"
 *  page and managed from the dashboard, ordered by `sortOrder`. */
@Entity('governing_body_members')
export class GoverningBodyMember {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 150, nullable: true })
  nameBn?: string | null;

  @Column({ name: 'designation', type: 'varchar', length: 150 })
  designation!: string;

  @Column({ name: 'designation_bn', type: 'varchar', length: 150, nullable: true })
  designationBn?: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl?: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}
