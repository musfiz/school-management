import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateStaffMemberDto {
  @ApiProperty({ example: 'Fatema Begum' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'ফাতেমা বেগম', description: 'Bangla display name; falls back to `name` when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameBn?: string;

  @ApiProperty({ example: 'Assistant Teacher' })
  @IsString()
  @MaxLength(150)
  designation!: string;

  @ApiPropertyOptional({ example: 'সহকারী শিক্ষক', description: 'Bangla designation; falls back to `designation` when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designationBn?: string;

  @ApiPropertyOptional({ example: '/uploads/staff.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** All fields optional — PATCH applies a partial update over the existing row. */
export class UpdateStaffMemberDto {
  @ApiPropertyOptional({ example: 'Fatema Begum' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'ফাতেমা বেগম' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameBn?: string;

  @ApiPropertyOptional({ example: 'Assistant Teacher' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designation?: string;

  @ApiPropertyOptional({ example: 'সহকারী শিক্ষক' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designationBn?: string;

  @ApiPropertyOptional({ example: '/uploads/staff.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
