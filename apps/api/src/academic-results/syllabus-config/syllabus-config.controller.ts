import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyllabusConfigService } from './syllabus-config.service';
import {
  BulkEnrollDto,
  BulkUpsertSyllabusDto,
  CloneSyllabusDto,
  CreateMasterSubjectDto,
  MasterSubjectsQueryDto,
  StudentEnrollmentsQueryDto,
  SyllabusScopeQueryDto,
  UpdateMasterSubjectDto,
} from './syllabus-config.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../database/entities/user-role.enum';
import { UpsertSyllabusRowDto } from '../../admissions/admissions.dto';

/**
 * Result Engine §PHASE 2 — syllabus, paper-merger & enrollment.
 * Served under `/academic-results/syllabus/*` (proxied by the web app's
 * `api/academic-results/[...path]` catch-all from Phase 4/7).
 */
@ApiTags('Academic Results — Syllabus Config')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
@Controller('academic-results/syllabus')
export class SyllabusConfigController {
  constructor(private readonly syllabus: SyllabusConfigService) {}

  /* ================= master subjects ================= */

  @Get('master-subjects')
  @ApiOperation({ summary: 'List the shared master subject catalogue (optional ?boardStream=)' })
  masterSubjects(@Query() q: MasterSubjectsQueryDto) {
    return this.syllabus.listMasterSubjects(q.boardStream);
  }

  @Post('master-subjects')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Create a master subject (shared with the admission wizard)' })
  createMasterSubject(@Body() dto: CreateMasterSubjectDto) {
    return this.syllabus.createMasterSubject(dto);
  }

  @Patch('master-subjects/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Update a master subject' })
  updateMasterSubject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMasterSubjectDto) {
    return this.syllabus.updateMasterSubject(id, dto);
  }

  @Delete('master-subjects/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Delete an unused master subject (blocked once referenced by a syllabus row)' })
  deleteMasterSubject(@Param('id', ParseUUIDPipe) id: string) {
    return this.syllabus.deleteMasterSubject(id);
  }

  /* ================= syllabus matrix ================= */

  @Get('matrix')
  @ApiOperation({ summary: 'List the syllabus matrix for a session + class' })
  listMatrix(@Query() q: SyllabusScopeQueryDto) {
    return this.syllabus.listSyllabus(q.academicSessionId, q.classOrDeptId);
  }

  @Get('matrix/validate')
  @ApiOperation({ summary: 'Report combined-paper group consistency (merged groups + issues)' })
  validateMatrix(@Query() q: SyllabusScopeQueryDto) {
    return this.syllabus.validateSyllabus(q.academicSessionId, q.classOrDeptId);
  }

  @Post('matrix')
  @ApiOperation({ summary: 'Upsert one syllabus row (role, paper merge, credits) with merge validation' })
  upsertMatrixRow(@Body() dto: UpsertSyllabusRowDto) {
    return this.syllabus.upsertSyllabusRow(dto);
  }

  @Post('matrix/bulk')
  @ApiOperation({ summary: 'Upsert many syllabus rows in one transaction' })
  bulkUpsertMatrix(@Body() dto: BulkUpsertSyllabusDto) {
    return this.syllabus.bulkUpsertSyllabusRows(dto.rows);
  }

  @Post('matrix/clone')
  @ApiOperation({ summary: 'Clone a previous session’s syllabus into a target session (skip-existing)' })
  cloneMatrix(@Body() dto: CloneSyllabusDto) {
    return this.syllabus.cloneSyllabus(dto);
  }

  @Delete('matrix/:id')
  @ApiOperation({ summary: 'Delete an unused syllabus row (blocked once students enrolled)' })
  removeMatrixRow(@Param('id', ParseUUIDPipe) id: string) {
    return this.syllabus.removeSyllabusRow(id);
  }

  /* ================= enrollment ================= */

  @Post('enrollments/bulk')
  @ApiOperation({ summary: 'Bulk-enroll a class/section’s compulsory set + per-student 4th subject' })
  bulkEnroll(@Body() dto: BulkEnrollDto) {
    return this.syllabus.bulkEnroll(dto);
  }

  @Get('enrollments')
  @ApiOperation({ summary: 'List a student’s subject enrollments (?studentId=&academicSessionId=)' })
  studentEnrollments(@Query() q: StudentEnrollmentsQueryDto) {
    return this.syllabus.listStudentEnrollments(q.studentId, q.academicSessionId);
  }
}
