import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import type { HeaderDisplayMode } from '../database/entities/site-setting.entity';

/** Blank strings from an emptied form field should clear the setting. Using
 *  `null` (not `undefined`) matters: repo.merge() skips undefined values but
 *  assigns null, and @IsOptional() still treats null as "absent" so @IsUrl
 *  isn't run against it. */
const blankToNull = Transform(({ value }: { value: unknown }) =>
  value === '' ? null : value,
);

/** Non-technical admins tend to paste bare domains ("facebook.com/school")
 *  instead of full URLs — auto-prepend https:// rather than rejecting it. */
const normalizeUrl = Transform(({ value }: { value: unknown }) => {
  if (typeof value !== 'string' || value === '') return value;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
});

/** All fields optional — the settings page saves a partial patch over the
 *  single existing row (see SiteSettingsService.update). */
export class UpdateSiteSettingDto {
  @ApiPropertyOptional({ example: 'Model High School' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  siteName?: string;

  @ApiPropertyOptional({ example: 'মডেল হাই স্কুল' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  siteNameBn?: string;

  @ApiPropertyOptional({ example: 'Knowledge · Discipline · Excellence' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @ApiPropertyOptional({ example: 'জ্ঞান · শৃঙ্খলা · উৎকর্ষতা' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  taglineBn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionBn?: string;

  @ApiPropertyOptional({ example: '/uploads/logo.png' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  logoUrl?: string;

  @ApiPropertyOptional({ enum: ['logo', 'info', 'both'], default: 'both' })
  @IsOptional()
  @IsIn(['logo', 'info', 'both'])
  headerDisplay?: HeaderDisplayMode;

  @ApiPropertyOptional({ example: '+880 2-9123456' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'info@modelhighschool.edu' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: '42 Education Road, Model Town, Dhaka 1207' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressBn?: string;

  @ApiPropertyOptional({ example: 1972 })
  @IsOptional()
  @IsInt()
  @Min(1800)
  established?: number;

  @ApiPropertyOptional({ example: '108765' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  eiin?: string;

  @ApiPropertyOptional()
  @blankToNull
  @normalizeUrl
  @IsOptional()
  @IsUrl({ require_protocol: true })
  facebookUrl?: string | null;

  @ApiPropertyOptional()
  @blankToNull
  @normalizeUrl
  @IsOptional()
  @IsUrl({ require_protocol: true })
  twitterUrl?: string | null;

  @ApiPropertyOptional()
  @blankToNull
  @normalizeUrl
  @IsOptional()
  @IsUrl({ require_protocol: true })
  linkedinUrl?: string | null;

  @ApiPropertyOptional()
  @blankToNull
  @normalizeUrl
  @IsOptional()
  @IsUrl({ require_protocol: true })
  youtubeUrl?: string | null;

  @ApiPropertyOptional({ example: '© 2026 Model High School. All rights reserved.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  copyrightText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  copyrightTextBn?: string;
}
