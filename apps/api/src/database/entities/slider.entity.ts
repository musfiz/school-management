import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** A single home-page slider slide — shown in the public hero carousel and
 *  managed from the dashboard, ordered by `sortOrder`. Active slides are
 *  shown on the site; inactive ones are kept for later. */
@Entity('sliders')
export class Slider {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'image_url', type: 'varchar', length: 255 })
  imageUrl!: string;

  @Column({ name: 'title_en', type: 'varchar', length: 200, nullable: true })
  titleEn?: string | null;

  @Column({ name: 'title_bn', type: 'varchar', length: 200, nullable: true })
  titleBn?: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}
