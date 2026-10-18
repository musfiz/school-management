import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/* ================= academic sessions ================= */

export class CreateAcademicSessionDto {
  @IsString() @MaxLength(50) sessionName!: string;
  @IsString() @MaxLength(20) sessionCode!: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

export class UpdateAcademicSessionDto {
  @IsOptional() @IsString() @MaxLength(50) sessionName?: string;
  @IsOptional() @IsString() @MaxLength(20) sessionCode?: string;
  @IsOptional() @IsDateString() startDate?: string | null;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

/* ================= classes / departments ================= */

export const CLASS_LEVELS = ['PLAY', 'SCHOOL', 'COLLEGE', 'MADRASAH', 'UNIVERSITY'] as const;

export class CreateClassOrDeptDto {
  @IsString() @MaxLength(100) name!: string;
  @IsString() @MaxLength(20) code!: string;
  @IsOptional() @IsIn([...CLASS_LEVELS] as string[]) level?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateClassOrDeptDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsOptional() @IsIn([...CLASS_LEVELS] as string[]) level?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/* ================= exam term types (dynamic) ================= */

export const ENGINE_BEHAVIORS = ['SUB_EXAM_CT', 'TERMINAL', 'CUMULATIVE_ANNUAL'] as const;

export class CreateExamTermTypeDto {
  @IsString() @MaxLength(100) name!: string;
  @IsString() @MaxLength(30) code!: string;
  @IsIn([...ENGINE_BEHAVIORS] as string[]) engineBehavior!: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateExamTermTypeDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(30) code?: string;
  @IsOptional() @IsIn([...ENGINE_BEHAVIORS] as string[]) engineBehavior?: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
