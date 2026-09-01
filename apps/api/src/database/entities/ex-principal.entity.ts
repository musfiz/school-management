import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** A single former principal — shown on the public "Ex-Principals" page and
 *  managed from the dashboard, ordered by `sortOrder`. A principal has no
 *  designation (unlike governing-body members); we record their term of
 *  office in `tenure` instead ("1990 – 1998"). */
@Entity('ex_principals')
export class ExPrincipal {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 150, nullable: true })
  nameBn?: string | null;

  @Column({ name: 'tenure', type: 'varchar', length: 150, nullable: true })
  tenure?: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl?: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}
