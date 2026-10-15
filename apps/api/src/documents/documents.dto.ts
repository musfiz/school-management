import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReportMetaDto {
  @IsString() label!: string;
  @IsString() value!: string;
}

class ReportColumnDto {
  @IsString() header!: string;
  @IsOptional() width?: number;
  @IsOptional() @IsString() align?: 'left' | 'right' | 'center';
}

export class GenericReportPdfDto {
  @IsString() title!: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReportMetaDto) meta?: ReportMetaDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReportColumnDto) columns!: ReportColumnDto[];
  @IsArray() rows!: string[][];
  @IsOptional() @IsArray() totals?: ReportMetaDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) notes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) signatures?: string[];
  @IsOptional() @IsString() copiesLine?: string;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
}
