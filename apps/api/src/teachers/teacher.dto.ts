import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min, IsDateString } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ example: 'Dr. A. Rahman' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'ড. এ. রহমান', description: 'Bangla display name; falls back to `name` when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameBn?: string;

  @ApiProperty({ example: 'Principal' })
  @IsString()
  @MaxLength(150)
  designation!: string;

  @ApiPropertyOptional({ example: 'অধ্যক্ষ', description: 'Bangla designation; falls back to `designation` when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designationBn?: string;

  @ApiPropertyOptional({ example: 'Administration' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  department?: string;

  @ApiPropertyOptional({ example: 'প্রশাসন', description: 'Bangla department; falls back to `department` when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  departmentBn?: string;

  @ApiPropertyOptional({ example: '/uploads/teacher.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageUrl?: string;

  @ApiPropertyOptional({ example: '2014-01-15', description: 'Date the teacher joined the school (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  jointDate?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** All fields optional — PATCH applies a partial update over the existing row. */
export class UpdateTeacherDto {
  @ApiPropertyOptional({ example: 'Dr. A. Rahman' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'ড. এ. রহমান' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameBn?: string;

  @ApiPropertyOptional({ example: 'Principal' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designation?: string;

  @ApiPropertyOptional({ example: 'অধ্যক্ষ' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designationBn?: string;

  @ApiPropertyOptional({ example: 'Administration' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  department?: string;

  @ApiPropertyOptional({ example: 'প্রশাসন' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  departmentBn?: string;

  @ApiPropertyOptional({ example: '/uploads/teacher.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageUrl?: string;

  @ApiPropertyOptional({ example: '2014-01-15' })
  @IsOptional()
  @IsDateString()
  jointDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
