import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateSliderDto {
  @ApiProperty({ example: '/uploads/slide.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  imageUrl!: string;

  @ApiPropertyOptional({ example: 'Welcome to our school' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEn?: string;

  @ApiPropertyOptional({ example: 'আমাদের স্কুলে স্বাগতম' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleBn?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true, description: 'Show this slide on the public site' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** All fields optional — PATCH applies a partial update over the existing row. */
export class UpdateSliderDto {
  @ApiPropertyOptional({ example: '/uploads/slide.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Welcome to our school' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEn?: string;

  @ApiPropertyOptional({ example: 'আমাদের স্কুলে স্বাগতম' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleBn?: string;

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
