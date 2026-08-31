import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Upserts a CMS page's bilingual content. The slug comes from the route
 *  param, not the body — it identifies which fixed page is being edited. */
export class UpsertPageDto {
  @ApiProperty({ example: 'About Us' })
  @IsString()
  @MaxLength(200)
  titleEn!: string;

  @ApiPropertyOptional({ example: 'আমাদের সম্পর্কে' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleBn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentBn?: string;

  @ApiPropertyOptional({ example: '/uploads/about-us.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageUrl?: string;
}
