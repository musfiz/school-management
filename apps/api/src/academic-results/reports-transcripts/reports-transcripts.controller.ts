import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../database/entities/user-role.enum';
import { ReportsTranscriptsService } from './reports-transcripts.service';
import {
  AnalyticsQueryDto,
  FailListQueryDto,
  MeritListQueryDto,
  TabulationQueryDto,
  TranscriptQueryDto,
} from './reports-transcripts.dto';

/**
 * Result Engine §PHASE 6 — reporting, marksheets, tabulation & analytics.
 * Served under `/academic-results/reports/*`. Every response is read from the
 * stored snapshot; nothing is recalculated here.
 */
@ApiTags('Academic Results — Reports & Transcripts')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
@Controller('academic-results/reports')
export class ReportsTranscriptsController {
  constructor(private readonly reports: ReportsTranscriptsService) {}

  @Get('transcript')
  @ApiOperation({ summary: 'Single student marksheet/transcript with QR payload' })
  transcript(@Query() query: TranscriptQueryDto) {
    return this.reports.getStudentTranscript(query.examTermId, query.studentId);
  }

  @Get('tabulation')
  @ApiOperation({ summary: 'Master tabulation broadsheet (snapshot-only, section filterable)' })
  tabulation(@Query() query: TabulationQueryDto) {
    return this.reports.getMasterTabulationBroadsheet(
      query.examTermId,
      query.sectionOrBatchId,
      query.includeComponents !== 'false',
    );
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Appeared/passed/failed, grade histogram, per-subject & per-teacher stats' })
  analytics(@Query() query: AnalyticsQueryDto) {
    return this.reports.getExamSummaryAnalytics(query.examTermId);
  }

  @Get('merit-list')
  @ApiOperation({ summary: 'Merit list by section / shift / class' })
  meritList(@Query() query: MeritListQueryDto) {
    return this.reports.getMeritList(query.examTermId, {
      scope: query.scope,
      sectionOrBatchId: query.sectionOrBatchId,
      shiftId: query.shiftId,
      limit: query.limit,
    });
  }

  @Get('fail-list')
  @ApiOperation({ summary: 'Fail list with per-subject fail reasons' })
  failList(@Query() query: FailListQueryDto) {
    return this.reports.getFailList(query.examTermId, query.sectionOrBatchId, query.limit);
  }
}
