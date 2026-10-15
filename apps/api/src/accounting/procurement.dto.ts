import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WITHHELD_TAX_TYPES, type WithheldTaxType } from '../database/entities/tax-challan-item.entity';

export class CreateVendorDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vendorCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  vendorName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  binNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tradeLicenseNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}

export class CreateVendorBillDto {
  @IsUUID()
  vendorId!: string;

  /** 5xxxx expense or 121xx asset GL id. */
  @IsUUID()
  expenseGlId!: string;

  @IsUUID()
  fundId!: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsDateString()
  billDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  supplierInvoiceNo?: string;

  /** Decimal string, e.g. `"100000.00"`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  grossAmount!: string;

  /** Decimal strings, e.g. `"10"`, `"7.5"`. Default `"0"`. */
  @IsOptional()
  @IsString()
  @MaxLength(6)
  tdsRate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  vdsRate?: string;

  @IsOptional()
  @IsBoolean()
  mushak63Received?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  narration?: string;
}

export class PayVendorBillDto {
  /** Cash/bank GL the payment leaves from. Defaults to 11201. */
  @IsOptional()
  @IsUUID()
  bankGlId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  amount!: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}

export class RemitTaxLegDto {
  @IsUUID()
  billId!: string;

  @IsIn(WITHHELD_TAX_TYPES)
  taxType!: WithheldTaxType;
}

export class CreateTaxChallanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  challanNo!: string;

  @IsDateString()
  challanDate!: string;

  /** Operating bank GL. Defaults to 11201. */
  @IsOptional()
  @IsUUID()
  bankGlId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  depositBankName?: string;

  /** Whole pending legs are remitted — no partial legs. */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RemitTaxLegDto)
  remit!: RemitTaxLegDto[];
}
