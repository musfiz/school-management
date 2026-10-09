import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Blank strings from an emptied form field should clear the value. `null`
 * (not `undefined`) matters here for the same reason as in site-setting.dto:
 * repo.merge() skips undefined but assigns null, so @IsOptional() treats a
 * cleared field as absent instead of failing validation.
 */
const blankToNull = Transform(({ value }: { value: unknown }) => (value === '' ? null : value));

const ITEM_KEYS = ['value', 'bullet', 'stat', 'card', 'image'] as const;
const BACKGROUNDS = ['white', 'muted', 'navy'] as const;

/** A repeating row inside a section. Same fields on create and update, so one
 *  class serves both; presence is detected per-property below. */
export class HomepageItemInputDto {
  @ApiPropertyOptional({ description: 'Existing item id when editing', example: 12 })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiPropertyOptional({ enum: ITEM_KEYS, default: 'card' })
  @IsOptional()
  @IsIn(ITEM_KEYS)
  itemKey?: (typeof ITEM_KEYS)[number];

  @ApiPropertyOptional({ example: 'Knowledge' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(200)
  titleEn?: string | null;

  @ApiPropertyOptional({ example: 'জ্ঞান' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(200)
  titleBn?: string | null;

  @ApiPropertyOptional({ example: 'Everything we know' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(200)
  subtitleEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(200)
  subtitleBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  bodyEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  bodyBn?: string | null;

  @ApiPropertyOptional({ description: 'Icon slot, e.g. book-open / shield / sparkles' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(40)
  icon?: string | null;

  @ApiPropertyOptional({ example: '/uploads/library.jpg' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(255)
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: '/about/about-us' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(255)
  href?: string | null;

  @ApiPropertyOptional({ example: '+' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(60)
  metaEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(60)
  metaBn?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class CreateHomepageSectionDto {
  @ApiProperty({ example: 'values' })
  @IsString()
  @MaxLength(60)
  sectionKey!: string;

  @ApiProperty({ example: 'Our Values' })
  @IsString()
  @MaxLength(120)
  labelEn!: string;

  @ApiPropertyOptional({ example: 'আমাদের মূল্যবোধ' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(120)
  labelBn?: string | null;

  @ApiPropertyOptional({ example: 'What we stand for' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(120)
  eyebrowEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(120)
  eyebrowBn?: string | null;

  @ApiPropertyOptional({ example: 'Knowledge. Discipline. Excellence.' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(200)
  titleEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(200)
  titleBn?: string | null;

  @ApiPropertyOptional({ description: 'HTML, sanitized at render' })
  @IsOptional()
  @blankToNull
  @IsString()
  bodyEn?: string | null;

  @ApiPropertyOptional({ description: 'HTML, sanitized at render' })
  @IsOptional()
  @blankToNull
  @IsString()
  bodyBn?: string | null;

  @ApiPropertyOptional({ example: '/uploads/campus.jpg' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(255)
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 'Learn our story' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(80)
  ctaTextEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(80)
  ctaTextBn?: string | null;

  @ApiPropertyOptional({ example: '/about/about-us' })
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(255)
  ctaHref?: string | null;

  @ApiPropertyOptional({ enum: BACKGROUNDS, default: 'white' })
  @IsOptional()
  @IsIn(BACKGROUNDS)
  background?: (typeof BACKGROUNDS)[number];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ type: [HomepageItemInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => HomepageItemInputDto)
  items?: HomepageItemInputDto[];
}

/** All fields optional — PATCH applies a partial update over the existing row.
 *  `items` is a whole-list replace (the dashboard editor is a single form),
 *  so omitting it leaves the current items untouched. */
export class UpdateHomepageSectionDto {
  @ApiPropertyOptional({ example: 'Our Values' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(120)
  labelBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(120)
  eyebrowEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(120)
  eyebrowBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(200)
  titleEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(200)
  titleBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  bodyEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  bodyBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(255)
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(80)
  ctaTextEn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(80)
  ctaTextBn?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @blankToNull
  @IsString()
  @MaxLength(255)
  ctaHref?: string | null;

  @ApiPropertyOptional({ enum: BACKGROUNDS })
  @IsOptional()
  @IsIn(BACKGROUNDS)
  background?: (typeof BACKGROUNDS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ type: [HomepageItemInputDto], description: 'Replaces the whole item list' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => HomepageItemInputDto)
  items?: HomepageItemInputDto[];
}