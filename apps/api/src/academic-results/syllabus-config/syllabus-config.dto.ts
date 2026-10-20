import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMasterSubjectDto, UpsertSyllabusRowDto } from '../../admissions/admissions.dto';

/* ================= master subjects ================= */

export class MasterSubjectsQueryDto {
  @IsOptional() @IsString() @MaxLength(30) boardStream?: string;
}

export class UpdateMasterSubjectDto {
  @IsOptional() @IsString() @MaxLength(30) subjectCode?: string;
  @IsOptional() @IsString() @MaxLength(150) subjectName?: string;
  @IsOptional() @IsString() @MaxLength(30) boardStream?: string;
  @IsOptional() @IsInt() @Min(1) @Max(9) paperNumber?: number | null;
}

export { CreateMasterSubjectDto };

/* ================= syllabus matrix ================= */

export class SyllabusScopeQueryDto {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
}

export class BulkUpsertSyllabusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertSyllabusRowDto)
  rows!: UpsertSyllabusRowDto[];
}

export class CloneSyllabusDto {
  @IsUUID() sourceAcademicSessionId!: string;
  @IsUUID() targetAcademicSessionId!: string;
  /** Limit the clone to specific classes/departments; omit to clone every class. */
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) classOrDeptIds?: string[];
}

/* ================= enrollment ================= */

export class FourthSubjectPickDto {
  @IsUUID() studentId!: string;
  @IsUUID() syllabusSubjectId!: string;
}

export class BulkEnrollDto {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
  @IsOptional() @IsUUID() sectionOrBatchId?: string;
  /** Per-student 4th-subject choice for classes with FOURTH_OPTIONAL rows. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FourthSubjectPickDto)
  fourthSubjectByStudent?: FourthSubjectPickDto[];
  /** Plan only; report what would be enrolled without writing. */
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

export class StudentEnrollmentsQueryDto {
  @IsUUID() studentId!: string;
  @IsOptional() @IsUUID() academicSessionId?: string;
}
