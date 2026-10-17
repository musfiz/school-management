import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FamilyLookupQueryDto {
  /** Guardian phone (01XXXXXXXXX / +8801XXXXXXXXX) or father/mother NID. */
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  query!: string;
}

export class CalculateWaiverQueryDto {
  @IsOptional() @IsNumberString() prevGpa?: string;
  @IsOptional() @IsString() @MaxLength(25) institutionType?: string;
  @IsOptional() @IsString() @MaxLength(40) quotaTag?: string;
  @IsOptional() @IsString() @MaxLength(25) residenceType?: string;
  @IsOptional() @IsUUID() familyId?: string;
}

export class CreatePresetDto {
  @IsString() @MaxLength(40) ruleCode!: string;
  @IsString() @MaxLength(120) ruleName!: string;
  @IsOptional() @IsString() @MaxLength(25) institutionType?: string | null;
  @IsOptional() @IsNumberString() minGpa?: string | null;
  @IsOptional() @IsNumberString() maxGpa?: string | null;
  @IsOptional() @IsString() @MaxLength(40) quotaTag?: string | null;
  @IsOptional() @IsString() @MaxLength(25) residenceType?: string | null;
  @IsString() waiverType!: string;
  @IsNumberString() admissionFeePct!: string;
  @IsNumberString() tuitionFeePct!: string;
  @IsOptional() @IsBoolean() requiresZakatEligible?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) priority?: number;
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null;
}

export class UpdatePresetDto {
  @IsOptional() @IsString() @MaxLength(120) ruleName?: string;
  @IsOptional() @IsString() @MaxLength(25) institutionType?: string | null;
  @IsOptional() @IsNumberString() minGpa?: string | null;
  @IsOptional() @IsNumberString() maxGpa?: string | null;
  @IsOptional() @IsString() @MaxLength(40) quotaTag?: string | null;
  @IsOptional() @IsString() @MaxLength(25) residenceType?: string | null;
  @IsOptional() @IsString() waiverType?: string;
  @IsOptional() @IsNumberString() admissionFeePct?: string;
  @IsOptional() @IsNumberString() tuitionFeePct?: string;
  @IsOptional() @IsBoolean() requiresZakatEligible?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null;
}

export class ApplyLillahDto {
  @IsUUID() studentId!: string;
  @IsUUID() familyId!: string;
  @IsOptional() @IsString() @MaxLength(255) remark?: string;
}

export class CreateMasterSubjectDto {
  @IsString() @MaxLength(30) subjectCode!: string;
  @IsString() @MaxLength(150) subjectName!: string;
  @IsOptional() @IsString() @MaxLength(30) boardStream?: string;
  @IsOptional() @IsInt() @Min(1) @Max(9) paperNumber?: number | null;
}

export class UpsertSyllabusRowDto {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
  @IsUUID() subjectId!: string;
  @IsOptional() @IsString() @MaxLength(40) combinedGroupCode?: string | null;
  @IsOptional() @IsString() @MaxLength(100) combinedGroupName?: string | null;
  @IsString() defaultSubjectRole!: string;
  @IsOptional() @IsString() @MaxLength(40) electiveGroup?: string | null;
  @IsOptional() @IsNumberString() creditHours?: string;
  @IsOptional() @IsNumberString() fullMarks?: string;
  @IsOptional() @IsString() @MaxLength(40) passEvaluationMode?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) displayOrder?: number;
}

export class SubjectPreviewQueryDto {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
  @IsOptional() @IsString() @MaxLength(40) academicGroup?: string;
}

export class EnrollSubjectsDto {
  @IsUUID() studentId!: string;
  @IsUUID() academicSessionId!: string;
  @IsArray() @IsString({ each: true }) syllabusSubjectIds!: string[];
}

/* ================= Workflow 4 — atomic onboarding ================= */

export class FamilyInputDto {
  /** Link the Workflow-1-verified family; omit to upsert by phone. */
  @IsOptional() @IsUUID() familyId?: string;
  @IsOptional() @IsString() @MaxLength(20) primaryGuardianPhone?: string;
  @IsOptional() @IsString() @MaxLength(120) fatherNameEn?: string;
  @IsOptional() @IsString() @MaxLength(120) fatherNameBn?: string | null;
  @IsOptional() @IsString() @MaxLength(25) fatherNid?: string | null;
  @IsOptional() @IsString() @MaxLength(80) fatherOccupation?: string | null;
  @IsOptional() @IsString() @MaxLength(120) motherNameEn?: string;
  @IsOptional() @IsString() @MaxLength(20) motherPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(120) localGuardianName?: string | null;
  @IsOptional() @IsString() @MaxLength(50) localGuardianRelation?: string | null;
  @IsOptional() @IsString() @MaxLength(20) localGuardianPhone?: string | null;
  @IsOptional() @IsString() presentAddress?: string;
  @IsOptional() @IsString() @MaxLength(80) upazilaThana?: string | null;
  @IsOptional() @IsString() @MaxLength(80) district?: string | null;
  @IsOptional() @IsBoolean() isZakatEligibleFamily?: boolean;
}

export class StudentIdentityDto {
  @IsString() @MaxLength(120) fullNameEn!: string;
  @IsOptional() @IsString() @MaxLength(120) fullNameBn?: string | null;
  @IsString() @MaxLength(15) gender!: string;
  @IsDateString() dateOfBirth!: string;
  @IsOptional() @IsString() @MaxLength(25) birthRegNo?: string | null;
  @IsOptional() @IsString() @MaxLength(25) nationalIdNo?: string | null;
  @IsString() @MaxLength(25) religion!: string;
  @IsOptional() @IsString() @MaxLength(10) bloodGroup?: string | null;
  @IsOptional() @IsString() @MaxLength(255) photoUrl?: string | null;
  @IsOptional() @IsString() medicalAllergyNotes?: string | null;
  @IsOptional() @IsString() @MaxLength(20) stipendMfsType?: string | null;
  @IsOptional() @IsString() @MaxLength(30) stipendAccountNo?: string | null;
  @IsOptional() @IsString() @MaxLength(120) pickupGuardianName?: string | null;
  @IsOptional() @IsString() @MaxLength(20) pickupGuardianPhone?: string | null;
  @IsDateString() admissionDate!: string;
}

export class PrevEducationInputDto {
  @IsString() @MaxLength(40) examTitle!: string;
  @IsString() @MaxLength(150) instituteName!: string;
  @IsOptional() @IsString() @MaxLength(40) educationBoard?: string | null;
  @IsOptional() @IsString() @MaxLength(40) academicGroup?: string | null;
  @IsOptional() @IsString() @MaxLength(30) rollNo?: string | null;
  @IsOptional() @IsString() @MaxLength(30) regNo?: string | null;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) passingYear?: number | null;
  @IsOptional() @IsNumberString() gpaObtained?: string | null;
  @IsOptional() @IsString() @MaxLength(50) tcNumber?: string | null;
  @IsOptional() @IsDateString() tcDate?: string | null;
}

export class PlacementInputDto {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
  @IsString() @MaxLength(25) institutionType!: string;
  @IsOptional() @IsUUID() shiftId?: string | null;
  @IsOptional() @IsUUID() sectionOrBatchId?: string | null;
  @IsOptional() @IsString() @MaxLength(40) academicGroup?: string | null;
  @IsOptional() @IsString() @MaxLength(25) enrollmentType?: string | null;
  @IsOptional() @IsString() @MaxLength(25) residenceType?: string | null;
  @IsOptional() @IsString() @MaxLength(40) quotaTag?: string | null;
  @IsOptional() @IsString() @MaxLength(40) boardRegistrationNo?: string | null;
  @IsOptional() @IsUUID() hostelSeatId?: string | null;
  @IsOptional() @IsUUID() transportRouteId?: string | null;
  /** Optional — omit for a quick directory add before the syllabus matrix exists. */
  @IsOptional() @IsArray() @IsString({ each: true }) syllabusSubjectIds?: string[];
}

export class WaiverInputsDto {
  @IsOptional() @IsNumberString() prevGpa?: string;
  @IsOptional() @IsString() @MaxLength(25) institutionType?: string | null;
  @IsOptional() @IsString() @MaxLength(40) quotaTag?: string | null;
  @IsOptional() @IsString() @MaxLength(25) residenceType?: string | null;
}

export class AdmissionFeeItemDto {
  @IsUUID() feeHeadId!: string;
  /** Overrides the head default. REQUIRED for CREDIT_HOUR heads. */
  @IsOptional() @IsNumberString() amount?: string;
}

export class CollectNowDto {
  @IsString() paymentChannel!: string;
  /** Defaults to the full invoice due. Must be ≤ due. */
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsUUID() cashGlId?: string | null;
  /** Required for MFS channels (idempotency key). */
  @IsOptional() @IsString() @MaxLength(80) gatewayTrxId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) bankReference?: string | null;
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null;
}

export class ConfirmAdmissionDto {
  @ValidateNested() @Type(() => FamilyInputDto) family!: FamilyInputDto;
  @ValidateNested() @Type(() => StudentIdentityDto) student!: StudentIdentityDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => PrevEducationInputDto)
  previousEducations?: PrevEducationInputDto[];
  @ValidateNested() @Type(() => PlacementInputDto) placement!: PlacementInputDto;
  @IsOptional() @ValidateNested() @Type(() => WaiverInputsDto) waiverInputs?: WaiverInputsDto;
  @IsOptional() @IsArray() @IsString({ each: true }) applyWaiverRuleCodes?: string[];
  /** Omit → auto-suggest (ONE_TIME + SESSION + first TUITION). */
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => AdmissionFeeItemDto)
  feeItems?: AdmissionFeeItemDto[];
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(255) narration?: string | null;
  /** Source application to close the loop on: flips status → ADMITTED + links the new student. */
  @IsOptional() @IsUUID() applicationId?: string;
  /** Present → Admit & Collect in the same transaction. */
  @IsOptional() @ValidateNested() @Type(() => CollectNowDto) collectNow?: CollectNowDto | null;
}

export class FeePreviewDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => AdmissionFeeItemDto)
  feeItems?: AdmissionFeeItemDto[];
  @IsOptional() @ValidateNested() @Type(() => WaiverInputsDto) waiverInputs?: WaiverInputsDto;
  @IsOptional() @IsUUID() familyId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) applyWaiverRuleCodes?: string[];
  @IsOptional() @IsDateString() admissionDate?: string;
}

/* ================= Phase 2 — campaigns & applications ================= */

export class CreateCampaignDto {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
  @IsString() @MaxLength(150) campaignTitle!: string;
  @IsOptional() @IsNumberString() applicationFee?: string;
  @IsInt() @Min(1) @Max(100000) totalSeats!: number;
  @IsOptional() @IsNumberString() minRequiredGpa?: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() @MaxLength(150) campaignTitle?: string;
  @IsOptional() @IsNumberString() applicationFee?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) totalSeats?: number;
  @IsOptional() @IsNumberString() minRequiredGpa?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SubmitApplicationDto {
  @IsUUID() campaignId!: string;
  @IsString() @MaxLength(120) applicantNameEn!: string;
  @IsOptional() @IsString() @MaxLength(120) applicantNameBn?: string | null;
  @IsString() @MaxLength(15) gender!: string;
  @IsDateString() dateOfBirth!: string;
  @IsOptional() @IsString() @MaxLength(25) birthRegNo?: string | null;
  @IsString() @MaxLength(20) guardianPhone!: string;
  @IsOptional() @IsString() @MaxLength(30) prevExamName?: string | null;
  @IsOptional() @IsString() @MaxLength(30) prevBoard?: string | null;
  @IsOptional() @IsString() @MaxLength(30) prevRollNo?: string | null;
  @IsOptional() @IsString() @MaxLength(30) prevRegNo?: string | null;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) prevPassingYear?: number | null;
  @IsOptional() @IsNumberString() prevGpa?: string | null;
  @IsOptional() @IsString() @MaxLength(40) quotaApplied?: string | null;
}

export class TestMarkInputDto {
  @IsUUID() applicationId!: string;
  @IsNumberString() marks!: string;
}

export class BulkTestMarksDto {
  @IsUUID() campaignId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => TestMarkInputDto)
  marks!: TestMarkInputDto[];
}

export class UpdateApplicationStatusDto {
  @IsString() status!: string;
}

export class CollectFormFeeDto {
  @IsOptional() @IsString() paymentChannel?: string;
  /** Defaults to the campaign's application_fee. */
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsUUID() cashGlId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null;
}

/* ================= Phase 5 — lifecycle (TC / promotion / transfer) ================= */

export class IssueTcDto {
  @IsOptional() @IsString() @MaxLength(50) tcNumber?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsString() @MaxLength(255) remark?: string;
  /** Required to waive outstanding dues — recorded on the student for audit. */
  @IsOptional() @IsString() @MaxLength(255) overrideReason?: string;
}

export class TransferSectionDto {
  @IsOptional() @IsUUID() academicSessionId?: string;
  @IsOptional() @IsUUID() sectionOrBatchId?: string | null;
  @IsOptional() @IsUUID() shiftId?: string | null;
  @IsOptional() @IsString() @MaxLength(40) academicGroup?: string | null;
}

export class PromoteStudentsDto {
  @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) studentIds!: string[];
  @IsUUID() targetSessionId!: string;
  @IsUUID() targetClassOrDeptId!: string;
  @IsOptional() @IsUUID() sectionOrBatchId?: string | null;
  @IsOptional() @IsString() @MaxLength(40) academicGroup?: string | null;
  @IsOptional() @IsString() @MaxLength(25) institutionType?: string;
  /** PROMOTED (default) or READMISSION. */
  @IsOptional() @IsString() @MaxLength(25) enrollmentType?: string;
}

/* ================= Phase 5 — student documents & verification (Plan §3.5) ================= */

export class UpsertStudentDocumentDto {
  /** 'BIRTH_CERT', 'FATHER_NID', 'MOTHER_NID', 'TC_COPY', 'SSC_MARKSHEET', 'ORPHAN_CERT', … */
  @IsString() @MaxLength(40) documentType!: string;
  @IsString() @MaxLength(255) fileUrl!: string;
  /** Colleges/Universities often hold the original SSC/HSC transcript. */
  @IsOptional() @IsBoolean() isOriginalSubmitted?: boolean;
}

export class UpdateStudentDocumentDto {
  @IsOptional() @IsString() @MaxLength(255) fileUrl?: string;
  @IsOptional() @IsBoolean() isOriginalSubmitted?: boolean;
}

export class VerifyStudentDocumentDto {
  @IsBoolean() verified!: boolean;
}

