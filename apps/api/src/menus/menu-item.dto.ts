import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** A leaf sub-item — one level deep, no further children (matches the
 *  real site nav, which never nests more than 2 levels). */
export class MenuChildInputDto {
  @ApiProperty({ example: 'History' })
  @IsString()
  @MaxLength(150)
  labelEn!: string;

  @ApiPropertyOptional({ example: 'ইতিহাস' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  labelBn?: string;

  @ApiProperty({ example: '/about/history' })
  @IsString()
  @MaxLength(255)
  href!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

/** A top-level menu item, optionally with one level of sub-items. */
export class MenuItemInputDto {
  @ApiProperty({ example: 'About' })
  @IsString()
  @MaxLength(150)
  labelEn!: string;

  @ApiPropertyOptional({ example: 'আমাদের সম্পর্কে' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  labelBn?: string;

  @ApiProperty({ example: '/about' })
  @IsString()
  @MaxLength(255)
  href!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ type: () => MenuChildInputDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuChildInputDto)
  children?: MenuChildInputDto[];
}

export class ReplaceMenuDto {
  @ApiProperty({ type: () => MenuItemInputDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemInputDto)
  items!: MenuItemInputDto[];
}
