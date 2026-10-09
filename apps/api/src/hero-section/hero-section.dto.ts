import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHeroSectionDto {
  @ApiPropertyOptional({ example: true, description: 'Whether to show the hero section on the homepage' })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ example: '2026–2027', description: 'Admission open academic year' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  admissionYear?: string;

  @ApiPropertyOptional({ example: 'Building Tomorrow’s Leaders', description: 'Tagline line 1 (EN)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline1?: string;

  @ApiPropertyOptional({ example: 'ভবিষ্যতের নেতৃত্ব গড়ে তোলা', description: 'Tagline line 1 (BN)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline1Bn?: string;

  @ApiPropertyOptional({ example: 'Inspiring Excellence in Every Student', description: 'Tagline line 2 (EN)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline2?: string;

  @ApiPropertyOptional({ example: 'প্রতিটি শিক্ষার্থীর শ্রেষ্ঠত্ব বিকাশ', description: 'Tagline line 2 (BN)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline2Bn?: string;

  @ApiPropertyOptional({ example: 'Through Knowledge & Values', description: 'Tagline line 3 (EN)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline3?: string;

  @ApiPropertyOptional({ example: 'জ্ঞান ও মূল্যবোধের আলোয়', description: 'Tagline line 3 (BN)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline3Bn?: string;

  @ApiPropertyOptional({ example: 'Empowering students with quality education...', description: 'Short description (EN)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'মানসম্মত শিক্ষার মাধ্যমে শিক্ষার্থীদের ক্ষমতায়ন...', description: 'Short description (BN)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortDescriptionBn?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether to show the Apply For Admission button' })
  @IsOptional()
  @IsBoolean()
  showApplyButton?: boolean;

  @ApiPropertyOptional({ example: 'Open house: Sep 19 · 10am', description: 'Institute open info (EN)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  instituteOpenInfo?: string;

  @ApiPropertyOptional({ example: 'খোলা থাকার সময়: রবি - বৃহস্পতি ৯টা - ৪টা', description: 'Institute open info (BN)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  instituteOpenInfoBn?: string;

  @ApiPropertyOptional({ example: '+880 1700-000000', description: 'Mobile / Phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
