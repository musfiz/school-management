import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** Where the header shows the logo, the site name/tagline text, or both. */
export type HeaderDisplayMode = 'logo' | 'info' | 'both';

/** Singleton row (id is always 1) holding the public site's header/footer
 *  configuration, editable from the dashboard's Site Settings page. */
@Entity('site_settings')
export class SiteSetting {
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  @Column({ name: 'site_name', type: 'varchar', length: 150, default: 'My School' })
  siteName!: string;

  @Column({ name: 'site_name_bn', type: 'varchar', length: 150, nullable: true })
  siteNameBn?: string | null;

  @Column({ name: 'tagline', type: 'varchar', length: 200, nullable: true })
  tagline?: string | null;

  @Column({ name: 'tagline_bn', type: 'varchar', length: 200, nullable: true })
  taglineBn?: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'description_bn', type: 'text', nullable: true })
  descriptionBn?: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 255, nullable: true })
  logoUrl?: string | null;

  @Column({
    name: 'header_display',
    type: 'varchar',
    length: 10,
    default: 'both',
  })
  headerDisplay!: HeaderDisplayMode;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
  email?: string | null;

  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true })
  address?: string | null;

  @Column({ name: 'address_bn', type: 'varchar', length: 255, nullable: true })
  addressBn?: string | null;

  @Column({ name: 'established', type: 'int', nullable: true })
  established?: number | null;

  @Column({ name: 'eiin', type: 'varchar', length: 30, nullable: true })
  eiin?: string | null;

  @Column({ name: 'facebook_url', type: 'varchar', length: 255, nullable: true })
  facebookUrl?: string | null;

  @Column({ name: 'twitter_url', type: 'varchar', length: 255, nullable: true })
  twitterUrl?: string | null;

  @Column({ name: 'linkedin_url', type: 'varchar', length: 255, nullable: true })
  linkedinUrl?: string | null;

  @Column({ name: 'youtube_url', type: 'varchar', length: 255, nullable: true })
  youtubeUrl?: string | null;

  @Column({ name: 'copyright_text', type: 'varchar', length: 255, nullable: true })
  copyrightText?: string | null;

  @Column({ name: 'copyright_text_bn', type: 'varchar', length: 255, nullable: true })
  copyrightTextBn?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at!: Date;
}
