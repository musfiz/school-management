import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SOURCE_MODULES,
  VOUCHER_TYPES,
  type SourceModule,
  type VoucherType,
} from '../database/entities/journal-entry.entity';
import { SUBLEDGER_TYPES, type SubledgerType } from '../database/entities/journal-line.entity';

/** One debit-or-credit leg. Amounts arrive as decimal strings (never float). */
export class JournalLineDto {
  @IsUUID()
  glAccountId!: string;

  @IsUUID()
  fundId!: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string | null;

  @IsOptional()
  @IsIn(SUBLEDGER_TYPES)
  subledgerType?: SubledgerType | null;

  @IsOptional()
  @IsUUID()
  subledgerId?: string | null;

  /** Decimal string, e.g. `"7500.00"`. Exactly one side must be positive. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  debitAmount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  creditAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lineMemo?: string | null;
}

export class CreateJournalEntryDto {
  @IsIn(VOUCHER_TYPES.filter((t) => t !== 'REVERSAL'))
  voucherType!: Exclude<VoucherType, 'REVERSAL'>;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;

  @IsOptional()
  @IsIn(SOURCE_MODULES)
  sourceModule?: SourceModule;

  @IsOptional()
  @IsUUID()
  sourceReferenceId?: string | null;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  narration!: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'A voucher needs at least two lines' })
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

/** Draft-only edit: narration/date/lines wholesale replacement. */
export class UpdateJournalDraftDto {
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  narration?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines?: JournalLineDto[];
}
