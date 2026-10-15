import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, IsString } from 'class-validator';

export class DateRangeReportDto {
  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by specific Fund (e.g. 01 General vs 02 Zakat)' })
  @IsOptional()
  @IsUUID()
  fundId?: string;

  @ApiPropertyOptional({ description: 'Filter by specific Cost Center' })
  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}

export class BalanceSheetQueryDto {
  @ApiPropertyOptional({ example: '2027-06-30', description: 'As of date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional({ description: 'Filter by specific Fund' })
  @IsOptional()
  @IsUUID()
  fundId?: string;
}

export class DefaulterAgingQueryDto {
  @ApiPropertyOptional({ example: '2026-10-15', description: 'As of date for aging calculation' })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional({ description: 'Filter by specific Cost Center / Dept' })
  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @ApiPropertyOptional({ description: 'Filter by invoice status', example: 'UNPAID' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class GeneralLedgerQueryDto extends DateRangeReportDto {
  @ApiProperty({ description: 'Chart of Account GL ID', required: true })
  @IsUUID()
  glAccountId!: string;
}
