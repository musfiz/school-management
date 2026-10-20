import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ================= marks sheet ================= */

export class MarksSheetQueryDto {
  @IsUUID() examTermId!: string;
  @IsUUID() syllabusSubjectId!: string;
  @IsOptional() @IsUUID() sectionOrBatchId?: string;
}

/* ================= bulk component marks ================= */

export class MarkRowDto {
  @IsUUID() studentId!: string;
  @IsUUID() componentId!: string;
  @IsOptional() @IsNumberString() rawMarksObtained?: string;
  @IsOptional() @IsBoolean() isAbsent?: boolean;
  @IsOptional() @IsBoolean() isExempted?: boolean;
}

export class BulkComponentMarksDto {
  @IsUUID() examTermId!: string;
  @IsUUID() syllabusSubjectId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkRowDto)
  rows!: MarkRowDto[];
}

/* ================= auto-populate ================= */

export class AutoPopulateDto {
  @IsUUID() examTermId!: string;
  /** Limit the run to one subject; omit for every auto-populated component. */
  @IsOptional() @IsUUID() syllabusSubjectId?: string;
}

/* ================= CSV / OMR import ================= */

export class ImportMarksDto {
  @IsUUID() examTermId!: string;
  @IsUUID() syllabusSubjectId!: string;
  @IsOptional() @IsUUID() sectionOrBatchId?: string;
  /** Inline CSV (used when no file part is uploaded, e.g. API clients/tests). */
  @IsOptional() @IsString() csv?: string;
  /** When false (default) the response is a dry-run diff; set true to commit. */
  @IsOptional() @IsBoolean() commit?: boolean;
}

/* ================= attendance ================= */

export class AttendanceQueryDto {
  @IsUUID() examTermId!: string;
}

export class AttendanceEntryDto {
  @IsUUID() studentId!: string;
  @IsNumberString() attendancePercentage!: string;
}

export class SetAttendanceDto {
  @IsUUID() examTermId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries!: AttendanceEntryDto[];
}
