import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNoticeDto {
  @ApiProperty({ example: 'Annual Sports Day 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'বার্ষিক ক্রীড়া প্রতিযোগিতা ২০২৬' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  titleBn?: string;

  @ApiPropertyOptional({ example: 'annual-sports-day-2026' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Academic' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'Notice regarding the upcoming sports competition.' })
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'আসন্ন ক্রীড়া প্রতিযোগিতা সংক্রান্ত বিজ্ঞপ্তি।' })
  @IsString()
  @IsOptional()
  shortDescriptionBn?: string;

  @ApiPropertyOptional({ example: '<p>Detailed information about the event...</p>' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '<p>বিস্তারিত তথ্য...</p>' })
  @IsString()
  @IsOptional()
  descriptionBn?: string;

  @ApiPropertyOptional({ example: '/uploads/notices/banner.jpg' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: '/uploads/documents/notice.pdf' })
  @IsString()
  @IsOptional()
  pdfUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-09-10' })
  @IsString()
  @IsOptional()
  publishDate?: string;
}

export class UpdateNoticeDto extends CreateNoticeDto {}
