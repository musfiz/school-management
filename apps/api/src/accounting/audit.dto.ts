import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class VoucherAuditQueryDto {
  @ApiPropertyOptional({ example: 'APPROVED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'JOURNAL' })
  @IsOptional()
  @IsString()
  voucherType?: string;

  @ApiPropertyOptional({ example: 'MANUAL' })
  @IsOptional()
  @IsString()
  sourceModule?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search voucher number, narration, or user name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class AuditLogQueryDto {
  @ApiPropertyOptional({ example: 'VOUCHER_APPROVED' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ example: 'JOURNAL_ENTRY' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
