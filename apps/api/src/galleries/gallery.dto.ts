import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGalleryDto {
  @ApiProperty({
    example: 'schools/default_school/gallery/uuid.webp',
    description: 'Mandatory gallery image storage key or URL',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  imageUrl!: string;

  @ApiPropertyOptional({ example: 'Annual Sports Day 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEn?: string;

  @ApiPropertyOptional({ example: 'বার্ষিক ক্রীড়া প্রতিযোগিতা ২০২৬' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleBn?: string;

  @ApiPropertyOptional({
    example: 'Exciting athletic events and prize distribution',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitleEn?: string;

  @ApiPropertyOptional({ example: 'উদ্বোধনী অনুষ্ঠান এবং পুরস্কার বিতরণ' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitleBn?: string;

  @ApiPropertyOptional({ example: 'Sports' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tagEn?: string;

  @ApiPropertyOptional({ example: 'খেলাধুলা' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tagBn?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Display in public gallery',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGalleryDto {
  @ApiPropertyOptional({ example: 'schools/default_school/gallery/uuid.webp' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Annual Sports Day 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEn?: string;

  @ApiPropertyOptional({ example: 'বার্ষিক ক্রীড়া প্রতিযোগিতা ২০২৬' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleBn?: string;

  @ApiPropertyOptional({
    example: 'Exciting athletic events and prize distribution',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitleEn?: string;

  @ApiPropertyOptional({ example: 'উদ্বোধনী অনুষ্ঠান এবং পুরস্কার বিতরণ' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitleBn?: string;

  @ApiPropertyOptional({ example: 'Sports' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tagEn?: string;

  @ApiPropertyOptional({ example: 'খেলাধুলা' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tagBn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
