import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PAYMENT_CHANNELS,
  type PaymentChannel,
} from '../database/entities/payment-collection.entity';

/* ---------------- Counter collection ---------------- */

export class CollectFeeDto {
  @IsUUID() studentId!: string;

  @IsUUID() invoiceId!: string;

  /** Gross amount credited to the student ledger (BDT, ≤ invoice due). */
  @IsNumberString() amount!: string;

  @IsIn(PAYMENT_CHANNELS) paymentChannel!: PaymentChannel;

  /** Debit GL override (default 11101 cash, 11201 challan, 1130x MFS). */
  @IsOptional() @IsUUID() cashGlId?: string | null;

  /** TDR commission override (default = channel % × amount). */
  @IsOptional() @IsNumberString() tdrFee?: string | null;

  /** Gateway trx id — required for MFS, optional manual ref otherwise. */
  @IsOptional() @IsString() @MaxLength(80) gatewayTrxId?: string | null;

  /** Bank scroll / challan leaf number typed at the counter. */
  @IsOptional() @IsString() @MaxLength(80) bankReference?: string | null;

  @IsOptional() @IsDateString() transactionDate?: string;

  @IsOptional() @IsString() @MinLength(3) @MaxLength(255) remark?: string | null;
}

/* ---------------- MFS webhook (idempotent) ---------------- */

export class MfsWebhookDto {
  /** bKash trxID / Nagad reference / SSLCommerz tran_id. */
  @IsString() @IsNotEmpty() @MaxLength(80) gatewayTrxId!: string;

  @IsUUID() studentId!: string;

  /** When omitted the oldest open invoice of the student is settled first. */
  @IsOptional() @IsUUID() invoiceId?: string | null;

  @IsNumberString() amount!: string;

  @IsOptional() @IsNumberString() tdrFee?: string | null;

  @IsOptional() @IsDateString() transactionDate?: string;

  /**
   * Shared-secret token configured per gateway (WEBHOOK_SECRET_<GATEWAY>).
   * Verified when the env var is set; open mode otherwise (dev).
   */
  @IsOptional() @IsString() signature?: string | null;
}

/* ---------------- Settlement & reversal ---------------- */

export class SettleCollectionDto {
  /** Mother-bank GL receiving the funds (default 11201). */
  @IsOptional() @IsUUID() bankGlId?: string | null;

  @IsOptional() @IsString() @MaxLength(80) settlementRef?: string | null;

  @IsOptional() @IsDateString() transactionDate?: string;
}

export class ReverseCollectionDto {
  @IsString() @MinLength(3) @MaxLength(255) reason!: string;
}
