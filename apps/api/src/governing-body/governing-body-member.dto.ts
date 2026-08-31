import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateGoverningBodyMemberDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'জন ডো', description: 'Bangla display name; falls back to `name` when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameBn?: string;

  @ApiProperty({ example: 'Chairperson' })
  @IsString()
  @MaxLength(150)
  designation!: string;

  @ApiPropertyOptional({ example: 'সভাপতি', description: 'Bangla designation; falls back to `designation` when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designationBn?: string;

  @ApiPropertyOptional({ example: '/uploads/john.jpg' })
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
export class UpdateGoverningBodyMemberDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'জন ডো' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameBn?: string;

  @ApiPropertyOptional({ example: 'Chairperson' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designation?: string;

  @ApiPropertyOptional({ example: 'সভাপতি' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designationBn?: string;

  @ApiPropertyOptional({ example: '/uploads/john.jpg' })
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
