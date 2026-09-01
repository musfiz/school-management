import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateExPrincipalDto {
  @ApiProperty({ example: 'Abdul Karim' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'আব্দুল করিম', description: 'Bangla display name; falls back to `name` when empty' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameBn?: string;

  @ApiPropertyOptional({ example: '1990 – 1998', description: 'Term of office, free text' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  tenure?: string;

  @ApiPropertyOptional({ example: '/uploads/principal.jpg' })
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
export class UpdateExPrincipalDto {
  @ApiPropertyOptional({ example: 'Abdul Karim' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'আব্দুল করিম' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameBn?: string;

  @ApiPropertyOptional({ example: '1990 – 1998' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  tenure?: string;

  @ApiPropertyOptional({ example: '/uploads/principal.jpg' })
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
