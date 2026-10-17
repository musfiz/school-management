import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ================= grading scales (configurator) ================= */

export class GradingRangeDto {
  @IsNumberString() minPercentage!: string;
  @IsNumberString() maxPercentage!: string;
  @IsString() @MaxLength(10) letterGrade!: string;
  @IsNumberString() gradePoint!: string;
  @IsOptional() @IsString() @MaxLength(100) descriptiveRemark?: string | null;
}

export class CreateGradingScaleDto {
  @IsString() @MaxLength(100) name!: string;
  @IsString() @MaxLength(30) scaleType!: string;
  @IsNumberString() maxPoint!: string;
  @IsNumberString() minPassPoint!: string;
  @IsOptional() @IsNumberString() minPassPercentage?: string;
  @IsOptional() @IsNumberString() fourthSubjectDeduction?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradingRangeDto)
  ranges!: GradingRangeDto[];
}

export class UpdateGradingScaleDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(30) scaleType?: string;
  @IsOptional() @IsNumberString() maxPoint?: string;
  @IsOptional() @IsNumberString() minPassPoint?: string;
  @IsOptional() @IsNumberString() minPassPercentage?: string;
  @IsOptional() @IsNumberString() fourthSubjectDeduction?: string;
  @IsOptional() isActive?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradingRangeDto)
  ranges?: GradingRangeDto[];
}

/* ================= terms ================= */

export class TermScopeQueryDto {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
  @IsOptional() @IsString() @MaxLength(30) termType?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
}

export class CreateExamTermDto {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
  @IsUUID() gradingScaleId!: string;
  @IsString() @MaxLength(100) termName!: string;
  @IsString() @MaxLength(30) termType!: string;
  @IsOptional() @IsUUID() parentTerminalExamId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(999) sequenceNo?: number;
  @IsOptional() @IsString() @MaxLength(30) ctAggregationMode?: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) ctBestCount?: number;
  @IsOptional() @IsNumberString() annualWeightPct?: string;
  @IsOptional() @IsString() @MaxLength(20) markRoundingMode?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) minCoursesToPromote?: number;
  @IsOptional() @IsNumberString() minCgpaToPromote?: string;
}

export class UpdateExamTermDto {
  @IsOptional() @IsUUID() gradingScaleId?: string;
  @IsOptional() @IsString() @MaxLength(100) termName?: string;
  @IsOptional() @IsUUID() parentTerminalExamId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(999) sequenceNo?: number;
  @IsOptional() @IsString() @MaxLength(30) ctAggregationMode?: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) ctBestCount?: number;
  @IsOptional() @IsNumberString() annualWeightPct?: string;
  @IsOptional() @IsString() @MaxLength(20) markRoundingMode?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) minCoursesToPromote?: number;
  @IsOptional() @IsNumberString() minCgpaToPromote?: string;
}

export class SetTermStatusDto {
  @IsString() @MaxLength(20) status!: string;
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
}

/* ================= term weights (CUMULATIVE_ANNUAL) ================= */

export class TermWeightItemDto {
  @IsUUID() childExamTermId!: string;
  @IsNumberString() weightPct!: string;
}

export class SetTermWeightsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TermWeightItemDto)
  weights!: TermWeightItemDto[];
}

/* ================= subject components ================= */

export class ComponentItemDto {
  @IsString() @MaxLength(30) componentCode!: string;
  @IsOptional() @IsString() @MaxLength(60) componentName?: string;
  @IsOptional() @IsString() @MaxLength(30) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(30) sourceComponentCode?: string | null;
  @IsNumberString() maxRawMarks!: string;
  @IsOptional() @IsNumberString() conversionWeightPct?: string;
  @IsOptional() @IsNumberString() minPassMarks?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) displayOrder?: number;
}

export class UpsertComponentDto extends ComponentItemDto {
  @IsUUID() syllabusSubjectId!: string;
}

export class ReplaceSubjectComponentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ComponentItemDto)
  components!: ComponentItemDto[];
}

export class ComponentQueryDto {
  @IsOptional() @IsUUID() syllabusSubjectId?: string;
}

export class BulkCopyComponentsDto {
  @IsUUID() sourceSyllabusSubjectId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  targetSyllabusSubjectIds!: string[];
}
