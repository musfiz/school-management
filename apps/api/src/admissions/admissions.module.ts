import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingModule } from '../accounting/accounting.module';
import { FamilyProfile } from '../database/entities/family-profile.entity';
import { StudentWaiver } from '../database/entities/student-waiver.entity';
import { Fund } from '../database/entities/fund.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { AcademicSubject } from '../database/entities/academic-subject.entity';
import { ClassSyllabusSubject } from '../database/entities/class-syllabus-subject.entity';
import { StudentSubjectEnrollment } from '../database/entities/student-subject-enrollment.entity';
import { WaiverPresetRule } from '../database/entities/waiver-preset-rule.entity';
import { Student } from '../database/entities/student.entity';
import { StudentEnrollment } from '../database/entities/student-enrollment.entity';
import { StudentPreviousEducation } from '../database/entities/student-previous-education.entity';
import { StudentDocument } from '../database/entities/student-document.entity';
import { RequiredDocumentRule } from "../database/entities/required-document-rule.entity";
import { AdmissionSequence } from '../database/entities/admission-sequence.entity';
import { FeeHead } from '../database/entities/fee-head.entity';
import { StudentInvoice } from '../database/entities/student-invoice.entity';
import { StudentCautionDeposit } from '../database/entities/student-caution-deposit.entity';
import { AdmissionCampaign } from '../database/entities/admission-campaign.entity';
import { AdmissionApplication } from '../database/entities/admission-application.entity';
import { FamilyRegistryService } from './family-registry.service';
import { FamilyRegistryController } from './family-registry.controller';
import { SequenceService } from './common/sequence.service';
import { StudentIdGeneratorService } from './common/student-id-generator.service';
import { RollNumberGeneratorService } from './common/roll-number-generator.service';
import { WaiverCalculatorService } from './waiver-calculator.service';
import { WaiverCalculatorController } from './waiver-calculator.controller';
import { SubjectEnrollmentService } from './subject-enrollment.service';
import { SubjectEnrollmentController } from './subject-enrollment.controller';
import { AdmissionApplicationService } from './admission-application.service';
import { AdmissionApplicationController } from './admission-application.controller';
import { RequiredDocumentRuleService } from './required-document-rule.service';
import { RequiredDocumentRuleController } from './required-document-rule.controller';
import { StudentOnboardingService } from './student-onboarding.service';
import { StudentOnboardingController } from './student-onboarding.controller';
import { StudentLifecycleService } from './student-lifecycle.service';
import { StudentLifecycleController } from './student-lifecycle.controller';
import { AdmissionDashboardService } from './admission-dashboard.service';
import { AdmissionDashboardController } from './admission-dashboard.controller';
import { StudentDocumentsService } from './student-documents.service';
import { StudentDocumentsController } from './student-documents.controller';

@Module({
  imports: [
    AccountingModule,
    TypeOrmModule.forFeature([
      FamilyProfile,
      Student,
      StudentEnrollment,
      StudentPreviousEducation,
      StudentDocument,
      AdmissionCampaign,
      AdmissionApplication,
      WaiverPresetRule,
      StudentWaiver,
      Fund,
      ChartOfAccount,
      AcademicSubject,
      ClassSyllabusSubject,
      StudentSubjectEnrollment,
      AdmissionSequence,
      FeeHead,
      StudentInvoice,
      StudentCautionDeposit, RequiredDocumentRule,
    ]),
  ],
  controllers: [
    FamilyRegistryController,
    WaiverCalculatorController,
    SubjectEnrollmentController,
    StudentOnboardingController,
    AdmissionApplicationController,
    StudentLifecycleController,
    AdmissionDashboardController,
    StudentDocumentsController,
    RequiredDocumentRuleController,
  ],
  providers: [
    FamilyRegistryService,
    WaiverCalculatorService,
    SubjectEnrollmentService,
    StudentOnboardingService,
    AdmissionApplicationService,
    StudentLifecycleService,
    SequenceService,
    StudentIdGeneratorService,
    RollNumberGeneratorService,
    AdmissionDashboardService,
    StudentDocumentsService,
    RequiredDocumentRuleService,
  ],
  exports: [
    FamilyRegistryService,
    WaiverCalculatorService,
    SubjectEnrollmentService,
    StudentOnboardingService,
    AdmissionApplicationService,
    StudentLifecycleService,
    SequenceService,
    StudentIdGeneratorService,
    RollNumberGeneratorService,
  ],
})
export class AdmissionsModule {}
