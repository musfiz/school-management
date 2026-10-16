import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * NOTE (Prisma migration, Wave 1): every column is now mapped explicitly to its
 * snake_case DB name.
 *
 * Previously these camelCase properties carried no `name:` mapping and no
 * SnakeNamingStrategy was configured, so TypeORM emitted `notices.titleBn` /
 * `notices.createdAt` and every query failed with `Unknown column
 * 'notice.titleBn'`. The mapping below makes the module functional and lets the
 * parity harness capture a real pre-migration golden before the service moves to
 * Prisma. Property names (and therefore the JSON wire shape) are unchanged.
 */
@Entity('notices')
export class Notice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'title_bn', type: 'varchar', length: 255, nullable: true })
  titleBn: string;

  @Column({ name: 'slug', type: 'varchar', length: 255, nullable: true })
  slug: string;

  @Column({ name: 'category', type: 'varchar', length: 100, default: 'General' })
  category: string;

  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription: string;

  @Column({ name: 'short_description_bn', type: 'text', nullable: true })
  shortDescriptionBn: string;

  @Column({ name: 'description', type: 'longtext', nullable: true })
  description: string;

  @Column({ name: 'description_bn', type: 'longtext', nullable: true })
  descriptionBn: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string;

  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl: string;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'publish_date', type: 'date', nullable: true })
  publishDate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
