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

export class CreateRoutineDto {
  @ApiProperty({ example: 'Class Routine 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: 'ক্লাস রুটিন ২০২৬' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleBn?: string;

  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  @IsString()
  @IsNotEmpty()
  academicSessionId!: string;

  @ApiProperty({ example: 'b2c3d4e5-0000-0000-0000-000000000002' })
  @IsString()
  @IsNotEmpty()
  classOrDeptId!: string;

  @ApiPropertyOptional({ example: 'c3d4e5f6-0000-0000-0000-000000000003' })
  @IsOptional()
  @IsString()
  academicGroupId?: string;

  @ApiPropertyOptional({ example: 'CLASS', default: 'CLASS' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiProperty({ example: '/uploads/documents/uuid.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  pdfUrl!: string;

  @ApiPropertyOptional({ example: 'Effective from January 2026' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoutineDto {
  @ApiPropertyOptional({ example: 'Class Routine 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'ক্লাস রুটিন ২০২৬' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleBn?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  @IsOptional()
  @IsString()
  academicSessionId?: string;

  @ApiPropertyOptional({ example: 'b2c3d4e5-0000-0000-0000-000000000002' })
  @IsOptional()
  @IsString()
  classOrDeptId?: string;

  @ApiPropertyOptional({ example: 'c3d4e5f6-0000-0000-0000-000000000003' })
  @IsOptional()
  @IsString()
  academicGroupId?: string;

  @ApiPropertyOptional({ example: 'CLASS' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({ example: '/uploads/documents/uuid.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pdfUrl?: string;

  @ApiPropertyOptional({ example: 'Effective from January 2026' })
  @IsOptional()
  @IsString()
  description?: string;

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

export class QueryRoutineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classOrDeptId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicGroupId?: string;

  @ApiPropertyOptional({ description: 'Filter by routine type (CLASS or EXAM)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Search term for title or description' })
  @IsOptional()
  @IsString()
  search?: string;
}
