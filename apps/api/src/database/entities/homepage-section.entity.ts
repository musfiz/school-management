import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * One homepage section ("About school", "Our values", "Notice board", …).
 *
 * The public homepage renders its visible sections in `sortOrder`, so an admin
 * can reorder or hide a section without a deploy. `sectionKey` is the stable
 * identifier the frontend maps to a component (`values`, `about`, …) — renaming
 * a section's display title is safe, but changing its key would orphan the
 * renderer and needs a matching code change.
 *
 * Section-level fields (heading, body, image, CTA) live here; repeating content
 * inside the section (cards, bullets, stats) lives in `HomepageItem`.
 */
@Entity('homepage_sections')
export class HomepageSection {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'section_key', type: 'varchar', length: 60, unique: true })
  sectionKey!: string;

  @Column({ name: 'label_en', type: 'varchar', length: 120 })
  labelEn!: string;

  @Column({ name: 'label_bn', type: 'varchar', length: 120, nullable: true })
  labelBn?: string | null;

  @Column({ name: 'eyebrow_en', type: 'varchar', length: 120, nullable: true })
  eyebrowEn?: string | null;

  @Column({ name: 'eyebrow_bn', type: 'varchar', length: 120, nullable: true })
  eyebrowBn?: string | null;

  @Column({ name: 'title_en', type: 'varchar', length: 200, nullable: true })
  titleEn?: string | null;

  @Column({ name: 'title_bn', type: 'varchar', length: 200, nullable: true })
  titleBn?: string | null;

  /** Long-form prose. Stored as HTML and sanitized at render (see lib/sanitize-html). */
  @Column({ name: 'body_en', type: 'text', nullable: true })
  bodyEn?: string | null;

  @Column({ name: 'body_bn', type: 'text', nullable: true })
  bodyBn?: string | null;

  /** Optional image for split sections. Persisted as a relative /uploads path. */
  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl?: string | null;

  @Column({ name: 'cta_text_en', type: 'varchar', length: 80, nullable: true })
  ctaTextEn?: string | null;

  @Column({ name: 'cta_text_bn', type: 'varchar', length: 80, nullable: true })
  ctaTextBn?: string | null;

  @Column({ name: 'cta_href', type: 'varchar', length: 255, nullable: true })
  ctaHref?: string | null;

  /** Background variant so the homepage can alternate bands visually. */
  @Column({ name: 'background', type: 'varchar', length: 20, default: 'white' })
  background!: 'white' | 'muted' | 'navy';

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}