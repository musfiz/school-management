import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  MaxLength,
  MinLength,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WAIVER_TYPES, type WaiverType } from '../database/entities/student-waiver.entity';

/* ---------------- Fee heads ---------------- */

export class CreateFeeHeadDto {
  @IsString() @IsNotEmpty() @MaxLength(30) headCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) headName!: string;
  @IsIn(['MONTHLY', 'TERM', 'CREDIT_HOUR', 'ONE_TIME'])
  billingType!: 'MONTHLY' | 'TERM' | 'CREDIT_HOUR' | 'ONE_TIME';
  @IsOptional() @IsNumberString() defaultAmount?: string;
  @IsOptional() @IsNumberString() perCreditRate?: string;
  @IsUUID() revenueGlId!: string;
  @IsOptional() @IsUUID() fundId?: string | null;
  @IsOptional() @IsUUID() costCenterId?: string | null;
  @IsOptional() @IsBoolean() isCautionDeposit?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateFeeHeadDto {
  @IsOptional() @IsString() @MaxLength(150) headName?: string;
  @IsOptional() @IsIn(['MONTHLY', 'TERM', 'CREDIT_HOUR', 'ONE_TIME'])
  billingType?: 'MONTHLY' | 'TERM' | 'CREDIT_HOUR' | 'ONE_TIME';
  @IsOptional() @IsNumberString() defaultAmount?: string;
  @IsOptional() @IsNumberString() perCreditRate?: string;
  @IsOptional() @IsUUID() revenueGlId?: string;
  @IsOptional() @IsUUID() fundId?: string | null;
  @IsOptional() @IsUUID() costCenterId?: string | null;
  @IsOptional() @IsBoolean() isCautionDeposit?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/* ---------------- Waivers ---------------- */

export class CreateWaiverDto {
  @IsUUID() studentId!: string;
  @IsIn(WAIVER_TYPES) waiverType!: WaiverType;
  /** 0–100 percentage applied to every invoice line while active. */
  @IsNumber() @Min(0) @Max(100) percent!: number;
  @IsOptional() @IsNumberString() fixedCapAmount?: string | null;
  @IsOptional() @IsUUID() contraGlId?: string | null;
  @IsOptional() @IsUUID() fundId?: string | null;
  @IsOptional() @IsDateString() activeFrom?: string | null;
  @IsOptional() @IsDateString() activeTo?: string | null;
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null;
}

export class UpdateWaiverDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) percent?: number;
  @IsOptional() @IsNumberString() fixedCapAmount?: string | null;
  @IsOptional() @IsUUID() contraGlId?: string | null;
  @IsOptional() @IsUUID() fundId?: string | null;
  @IsOptional() @IsDateString() activeFrom?: string | null;
  @IsOptional() @IsDateString() activeTo?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null;
}

/* ---------------- Invoices ---------------- */

export class InvoiceItemDto {
  @IsUUID() feeHeadId!: string;
  /** Overrides the head default (fixed heads). */
  @IsOptional() @IsNumberString() amount?: string;
  /** Credit-hour heads: hours × perCreditRate. */
  @IsOptional() @IsNumberString() creditHours?: string;
  @IsOptional() @IsUUID() costCenterId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) lineMemo?: string | null;
}

export class CreateInvoiceDto {
  @IsUUID() studentId!: string;
  /** e.g. '2026-10'. Unique per student — duplicate billing rejected. */
  @IsString() @IsNotEmpty() @MaxLength(30) billingPeriod!: string;
  @IsDateString() issueDate!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsUUID() costCenterId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) narration?: string | null;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

export class BulkInvoiceDto {
  @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) studentIds!: string[];
  @IsString() @IsNotEmpty() @MaxLength(30) billingPeriod!: string;
  @IsDateString() issueDate!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsUUID() costCenterId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) narration?: string | null;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

/* ---------------- Caution deposits ---------------- */

export class CreateCautionDepositDto {
  @IsUUID() studentId!: string;
  /** Must be a 21401/21402 liability GL. */
  @IsUUID() glAccountId!: string;
  @IsNumberString() amount!: string;
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null;
  /** Cash/bank GL that received the deposit (default 11101). */
  @IsOptional() @IsUUID() cashGlId?: string | null;
  @IsOptional() @IsUUID() fundId?: string | null;
  @IsOptional() @IsUUID() costCenterId?: string | null;
  @IsOptional() @IsDateString() transactionDate?: string;
}

export class SettleCautionDepositDto {
  /** ADJUSTED (against dues) or REFUNDED (cash out). */
  @IsIn(['ADJUSTED', 'REFUNDED']) action!: 'ADJUSTED' | 'REFUNDED';
  /** Required when ADJUSTED: invoice to absorb the deposit. */
  @IsOptional() @IsUUID() invoiceId?: string;
  @IsOptional() @IsUUID() cashGlId?: string | null;
  @IsOptional() @IsUUID() fundId?: string | null;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(255) remark?: string;
}

/* ---------------- Late fines ---------------- */

export class ApplyLateFineDto {
  @IsNumberString() fineAmount!: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(255) memo?: string;
}
