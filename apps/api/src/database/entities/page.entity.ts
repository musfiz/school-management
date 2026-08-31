import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** A CMS content page, keyed by a fixed slug (e.g. 'about-us', 'history').
 *  One row per slug — created on first save, edited from the dashboard. */
@Entity('pages')
export class Page {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  slug!: string;

  @Column({ name: 'title_en', type: 'varchar', length: 200 })
  titleEn!: string;

  @Column({ name: 'title_bn', type: 'varchar', length: 200, nullable: true })
  titleBn?: string | null;

  @Column({ name: 'content_en', type: 'text', nullable: true })
  contentEn?: string | null;

  @Column({ name: 'content_bn', type: 'text', nullable: true })
  contentBn?: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}
