import { Module } from '@nestjs/common';
import { AdmissionsModule } from '../admissions/admissions.module';
import { AcademicSetupController } from './academic-setup/academic-setup.controller';
import { AcademicSetupService } from './academic-setup/academic-setup.service';
import { SyllabusConfigController } from './syllabus-config/syllabus-config.controller';
import { SyllabusConfigService } from './syllabus-config/syllabus-config.service';
import { LookupsController } from './lookups/lookups.controller';
import { LookupsService } from './lookups/lookups.service';
import { ExamSetupController } from './exam-setup/exam-setup.controller';
import { ExamSetupService } from './exam-setup/exam-setup.service';
import { MarksEntryController } from './marks-entry/marks-entry.controller';
import { MarksEntryService } from './marks-entry/marks-entry.service';
import { CsvOmrParserService } from './marks-entry/csv-omr-parser.service';
import { AttendanceAdapterService } from './common/attendance-adapter.service';
import { PreFlightService } from './calculation-engine/pre-flight.service';
import { ResultCalculationService } from './calculation-engine/result-calculation.service';
import { ResultJobRunnerService } from './calculation-engine/result-job-runner.service';
import { ResultJobsController } from './calculation-engine/result-jobs.controller';
import { ReportsTranscriptsService } from './reports-transcripts/reports-transcripts.service';
import { ReportsTranscriptsController } from './reports-transcripts/reports-transcripts.controller';

/**
 * Academic Results — Exam & Result Engine (docs/RESULT_ENGINE_EXECUTION_PLAN.md).
 *
 * Phase 1 delivers the data model (11 tables), the Bangladesh master seeder and
 * this skeleton. Phase 2 adds `syllabus-config/`, Phase 3 `exam-setup/`, Phase 4
 * `marks-entry/` (+ `common/attendance-adapter`) and Phase 5 `calculation-engine/`
 * (8-stage engine, pre-flight and the in-DB job runner). Phase 6 adds
 * `reports-transcripts/`.
 *
 * `PrismaService` is injected directly from the global `PrismaModule`; no
 * explicit import is required here (see src/prisma/prisma.module.ts).
 * `AdmissionsModule` is imported for the shared `SubjectEnrollmentService`.
 */
@Module({
  imports: [AdmissionsModule],
  controllers: [
    AcademicSetupController,
    SyllabusConfigController,
    LookupsController,
    ExamSetupController,
    MarksEntryController,
    ResultJobsController,
    ReportsTranscriptsController,
  ],
  providers: [
    AcademicSetupService,
    SyllabusConfigService,
    LookupsService,
    ExamSetupService,
    MarksEntryService,
    CsvOmrParserService,
    AttendanceAdapterService,
    PreFlightService,
    ResultCalculationService,
    ResultJobRunnerService,
    ReportsTranscriptsService,
  ],
})
export class AcademicResultsModule {}
