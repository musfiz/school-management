import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/* ================= transcript ================= */

export class TranscriptQueryDto {
  @IsUUID() examTermId!: string;
  @IsUUID() studentId!: string;
}

/* ================= tabulation broadsheet ================= */

export class TabulationQueryDto {
  @IsUUID() examTermId!: string;
  @IsOptional() @IsUUID() sectionOrBatchId?: string;
  /**
   * Query params arrive as strings; `includeComponents=false` trims the
   * per-component detail from the payload (the matrix itself is unchanged).
   */
  @IsOptional() @IsIn(['true', 'false']) includeComponents?: string;
}

/* ================= analytics ================= */

export class AnalyticsQueryDto {
  @IsUUID() examTermId!: string;
}

/* ================= merit / fail lists ================= */

export class MeritListQueryDto {
  @IsUUID() examTermId!: string;
  @IsOptional() @IsIn(['section', 'shift', 'class']) scope?: 'section' | 'shift' | 'class';
  @IsOptional() @IsUUID() sectionOrBatchId?: string;
  @IsOptional() @IsUUID() shiftId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(2000) limit?: number;
}

export class FailListQueryDto {
  @IsUUID() examTermId!: string;
  @IsOptional() @IsUUID() sectionOrBatchId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(2000) limit?: number;
}

/** Shared `sectionOrBatchId`/`shiftId` free-text guards for future leaves. */
export class ScopeFilterDto {
  @IsOptional() @IsString() sectionOrBatchId?: string;
  @IsOptional() @IsString() shiftId?: string;
}
