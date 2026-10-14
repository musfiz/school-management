import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ACCOUNT_TYPES,
  type AccountType,
  type NormalBalance,
} from '../database/entities/chart-of-account.entity';
import {
  INSTITUTION_TYPES,
  type InstitutionType,
} from '../database/entities/cost-center.entity';

/* ---------------- Funds ---------------- */

export class CreateFundDto {
  @ApiProperty({ example: '01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  fundCode!: string;

  @ApiProperty({ example: 'General Fund' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fundName!: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isRestricted?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  shariahCompliant?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateFundDto extends CreateFundDto {}

/* ---------------- Cost centers ---------------- */

export class CreateCostCenterDto {
  @ApiProperty({ example: '102' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  centerCode!: string;

  @ApiProperty({ example: 'Science / CSE Dept' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  centerName!: string;

  @ApiPropertyOptional({ example: 'SCHOOL', enum: INSTITUTION_TYPES })
  @IsIn(INSTITUTION_TYPES)
  @IsOptional()
  institutionType?: InstitutionType;

  @ApiPropertyOptional({ example: null })
  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCostCenterDto extends CreateCostCenterDto {}

/* ---------------- Chart of accounts ---------------- */

export class CreateAccountDto {
  @ApiProperty({ example: '41101' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[0-9]+$/, { message: 'glCode must be numeric' })
  glCode!: string;

  @ApiProperty({ example: 'Tuition Fee Revenue' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  accountName!: string;

  @ApiPropertyOptional({ example: 'বেতন আয়' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  accountNameBn?: string;

  @ApiProperty({ example: 'REVENUE', enum: ACCOUNT_TYPES })
  @IsIn(ACCOUNT_TYPES)
  accountType!: AccountType;

  @ApiPropertyOptional({ example: 'CR', enum: ['DR', 'CR'] })
  @IsIn(['DR', 'CR'])
  @IsOptional()
  normalBalance?: NormalBalance;

  @ApiPropertyOptional({ example: null })
  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isControlAccount?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isCashOrBank?: boolean;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  @IsOptional()
  defaultFundId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAccountDto extends CreateAccountDto {}

/* ---------------- Fiscal periods ---------------- */

export class CreateFiscalPeriodDto {
  @ApiProperty({ example: 'FY 2026-2027 (July-June)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  periodName!: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2027-06-30' })
  @IsString()
  @IsNotEmpty()
  endDate!: string;
}

export class UpdateFiscalPeriodDto extends CreateFiscalPeriodDto {}
