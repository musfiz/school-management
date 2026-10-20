import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
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
import { EnrollmentsController } from './enrollments.controller';
import { AdmissionDashboardService } from './admission-dashboard.service';
import { AdmissionDashboardController } from './admission-dashboard.controller';
import { StudentDocumentsService } from './student-documents.service';
import { StudentDocumentsController } from './student-documents.controller';
import { PreviousEducationService } from './previous-education.service';
import { PreviousEducationController } from './previous-education.controller';

@Module({
  imports: [AccountingModule],
  controllers: [
    FamilyRegistryController,
    WaiverCalculatorController,
    SubjectEnrollmentController,
    StudentOnboardingController,
    AdmissionApplicationController,
    StudentLifecycleController,
    EnrollmentsController,
    AdmissionDashboardController,
    StudentDocumentsController,
    RequiredDocumentRuleController,
    PreviousEducationController,
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
    PreviousEducationService,
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
