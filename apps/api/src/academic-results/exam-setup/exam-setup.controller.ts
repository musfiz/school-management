import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExamSetupService } from './exam-setup.service';
import {
  BulkCopyComponentsDto,
  ComponentQueryDto,
  CreateExamTermDto,
  CreateGradingScaleDto,
  ReplaceSubjectComponentsDto,
  SetTermStatusDto,
  SetTermWeightsDto,
  TermScopeQueryDto,
  UpdateExamTermDto,
  UpdateGradingScaleDto,
  UpsertComponentDto,
} from './exam-setup.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user-role.enum';

/**
 * Result Engine §PHASE 3 — exam terms, CT rules & component distribution.
 * Served under `/academic-results/exam-setup/*`.
 */
@ApiTags('Academic Results — Exam Setup')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
@Controller('academic-results/exam-setup')
export class ExamSetupController {
  constructor(private readonly examSetup: ExamSetupService) {}

  /* ================= grading scales (read-only, seeded) ================= */

  @Get('grading-scales')
  @ApiOperation({ summary: 'List active grading scales (seeded master data)' })
  listGradingScales() {
    return this.examSetup.listGradingScales();
  }

  @Post('grading-scales')
  @ApiOperation({ summary: 'Create a grading scale with its range ladder (Phase 7 configurator)' })
  createGradingScale(@Body() dto: CreateGradingScaleDto) {
    return this.examSetup.createGradingScale(dto);
  }

  @Put('grading-scales/:id')
  @ApiOperation({ summary: 'Update a grading scale (ranges are replaced atomically)' })
  updateGradingScale(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGradingScaleDto) {
    return this.examSetup.updateGradingScale(id, dto);
  }

  @Delete('grading-scales/:id')
  @ApiOperation({ summary: 'Delete an unused grading scale (blocked while any term references it)' })
  deleteGradingScale(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetup.deleteGradingScale(id);
  }

  @Get('attendance-slabs')
  @ApiOperation({ summary: 'List the seeded attendance → mark slabs (AD-4)' })
  listAttendanceSlabs() {
    return this.examSetup.listAttendanceSlabs();
  }

  @Get('grading-scales/:id')
  @ApiOperation({ summary: 'Get a grading scale with its percentage ranges' })
  getGradingScale(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetup.getGradingScale(id);
  }

  /* ================= exam terms ================= */

  @Get('terms')
  @ApiOperation({ summary: 'List exam terms for a session + class (?termType=&status=)' })
  listTerms(@Query() q: TermScopeQueryDto) {
    return this.examSetup.listTerms(q);
  }

  @Post('terms')
  @ApiOperation({ summary: 'Create an exam term (SUB_EXAM_CT | TERMINAL | CUMULATIVE_ANNUAL)' })
  createTerm(@Body() dto: CreateExamTermDto) {
    return this.examSetup.createTerm(dto);
  }

  @Get('terms/:id')
  @ApiOperation({ summary: 'Get an exam term with grading scale and child/component counts' })
  getTerm(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetup.getTermDetail(id);
  }

  @Patch('terms/:id')
  @ApiOperation({ summary: 'Update term metadata (SETUP only)' })
  updateTerm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExamTermDto) {
    return this.examSetup.updateTerm(id, dto);
  }

  @Delete('terms/:id')
  @ApiOperation({ summary: 'Delete an unreferenced term (SETUP only)' })
  deleteTerm(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetup.deleteTerm(id);
  }

  @Post('terms/:id/status')
  @ApiOperation({ summary: 'CC-18 state transition (reopen requires EXAM_CONTROLLER)' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTermStatusDto,
    @CurrentUser() user: { id?: string; role?: string },
    @Ip() ip: string,
  ) {
    return this.examSetup.setTermStatus(id, dto, { id: user?.id, role: user?.role }, ip);
  }

  /* ================= term weights (CUMULATIVE_ANNUAL) ================= */

  @Get('terms/:id/weights')
  @ApiOperation({ summary: 'List a cumulative-annual term’s child weights' })
  getWeights(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetup.getTermWeights(id);
  }

  @Put('terms/:id/weights')
  @ApiOperation({ summary: 'Replace child weights (must sum to 100, SETUP only)' })
  setWeights(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetTermWeightsDto) {
    return this.examSetup.setTermWeights(id, dto);
  }

  /* ================= subject components ================= */

  @Get('terms/:id/components')
  @ApiOperation({ summary: 'List a term’s subject components (?syllabusSubjectId=)' })
  listComponents(@Param('id', ParseUUIDPipe) id: string, @Query() q: ComponentQueryDto) {
    return this.examSetup.listComponents(id, q.syllabusSubjectId);
  }

  @Get('terms/:id/components/validate')
  @ApiOperation({ summary: 'CC-17 report: Σ converted_max_marks vs syllabus full_marks per subject' })
  validateComponents(@Param('id', ParseUUIDPipe) id: string) {
    return this.examSetup.componentReport(id);
  }

  @Post('terms/:id/components')
  @ApiOperation({ summary: 'Add/update one component (converted_max_marks computed server-side)' })
  upsertComponent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertComponentDto) {
    return this.examSetup.upsertComponent(id, dto);
  }

  @Put('terms/:id/components/:syllabusSubjectId')
  @ApiOperation({ summary: 'Replace one subject’s component set (enforces Σ = full_marks, CC-17)' })
  replaceComponents(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('syllabusSubjectId', ParseUUIDPipe) syllabusSubjectId: string,
    @Body() dto: ReplaceSubjectComponentsDto,
  ) {
    return this.examSetup.replaceSubjectComponents(id, syllabusSubjectId, dto.components);
  }

  @Delete('terms/:id/components/:componentId')
  @ApiOperation({ summary: 'Delete one component (SETUP only)' })
  deleteComponent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('componentId', ParseUUIDPipe) componentId: string,
  ) {
    return this.examSetup.deleteComponent(id, componentId);
  }

  @Post('terms/:id/components/bulk-copy')
  @ApiOperation({ summary: 'Copy a subject’s component set onto other subjects of the same term' })
  bulkCopyComponents(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkCopyComponentsDto) {
    return this.examSetup.bulkCopyComponents(id, dto);
  }
}
