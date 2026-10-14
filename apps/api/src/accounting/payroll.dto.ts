import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePayrollRunDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'payrollMonth must be YYYY-MM' })
  payrollMonth!: string;

  @IsDateString()
  payDate!: string;

  @IsUUID()
  fundId!: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  narration?: string;
}

export class AddPayslipDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  employeeName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  /** Informational MPO EFT — displayed, never posted. */
  @IsOptional()
  @IsString()
  @MaxLength(18)
  mpoGovtAmount?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  institutionalGrossAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  pfEmployeeDeduction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  pfEmployerContribution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  aitTdsDeduction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  loanDeduction?: string;
}

export class PayPayrollRunDto {
  /** Operating bank GL. Defaults to 11201. */
  @IsOptional()
  @IsUUID()
  bankGlId?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}

export class CreateHonorariumDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  adjunctName!: string;

  @IsOptional()
  @IsUUID()
  adjunctId?: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'workMonth must be YYYY-MM' })
  workMonth!: string;

  @IsInt()
  @Min(0)
  classesCount!: number;

  @IsInt()
  @Min(0)
  scriptsCount!: number;

  @IsInt()
  @Min(0)
  vivaCount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  ratePerClass!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  ratePerScript!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  ratePerViva!: string;

  /** NBR TDS for honorarium: 10–15%. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  tdsRate!: string;

  @IsUUID()
  fundId!: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  narration?: string;
}

export class PayHonorariumDto {
  @IsOptional()
  @IsUUID()
  bankGlId?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}
