import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { HomepageSection } from './homepage-section.entity';

/**
 * A repeating element inside a homepage section — a values pillar, an about
 * bullet, a stat tile, a gallery photo, a program card.
 *
 * One shape covers every card-style section so adding a new homepage section
 * never needs a schema change. `itemKey` is a semantic slot the renderer uses
 * to pick a treatment (e.g. `stat` renders the value big, `bullet` renders a
 * tick list). Unused columns stay null and renderers ignore them.
 */
@Entity('homepage_items')
export class HomepageItem {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'section_id', type: 'int' })
  sectionId!: number;

  @ManyToOne(() => HomepageSection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section?: HomepageSection;

  /** Semantic slot within the section: `value`, `bullet`, `stat`, `card`, `image`. */
  @Column({ name: 'item_key', type: 'varchar', length: 40, default: 'card' })
  itemKey!: string;

  @Column({ name: 'title_en', type: 'varchar', length: 200, nullable: true })
  titleEn?: string | null;

  @Column({ name: 'title_bn', type: 'varchar', length: 200, nullable: true })
  titleBn?: string | null;

  @Column({ name: 'subtitle_en', type: 'varchar', length: 200, nullable: true })
  subtitleEn?: string | null;

  @Column({ name: 'subtitle_bn', type: 'varchar', length: 200, nullable: true })
  subtitleBn?: string | null;

  @Column({ name: 'body_en', type: 'text', nullable: true })
  bodyEn?: string | null;

  @Column({ name: 'body_bn', type: 'text', nullable: true })
  bodyBn?: string | null;

  /**
   * Icon slot. A short token the frontend maps to a bundled SVG (e.g.
   * `book-open`, `shield`, `sparkles`) — deliberately not a raw icon URL, so a
   * typo can't leave an unstyled box on the public page.
   */
  @Column({ name: 'icon', type: 'varchar', length: 40, nullable: true })
  icon?: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl?: string | null;

  @Column({ name: 'href', type: 'varchar', length: 255, nullable: true })
  href?: string | null;

  /** Prefix/suffix decoration for stat tiles, e.g. value "2,400" suffix "+". */
  @Column({ name: 'meta_en', type: 'varchar', length: 60, nullable: true })
  metaEn?: string | null;

  @Column({ name: 'meta_bn', type: 'varchar', length: 60, nullable: true })
  metaBn?: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}