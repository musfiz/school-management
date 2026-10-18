import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcademicSetupService } from './academic-setup.service';
import {
  CreateAcademicSessionDto,
  CreateAcademicGroupDto,
  CreateClassOrDeptDto,
  CreateExamTermTypeDto,
  CreateSectionOrBatchDto,
  UpdateAcademicSessionDto,
  UpdateAcademicGroupDto,
  UpdateClassOrDeptDto,
  UpdateExamTermTypeDto,
  UpdateSectionOrBatchDto,
} from './academic-setup.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../database/entities/user-role.enum';

/**
 * Result Engine — academic session + class/dept master data.
 * Served under `/academic-results/academic-setup/*` so the web app's existing
 * `api/academic-results/[...path]` proxy forwards it with no extra route.
 */
@ApiTags('Academic Results — Academic Setup')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('academic-results/academic-setup')
export class AcademicSetupController {
  constructor(private readonly setup: AcademicSetupService) {}

  /* ================= sessions ================= */

  @Get('sessions')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
  @ApiOperation({ summary: 'List academic sessions (?includeInactive=true)' })
  listSessions(@Query('includeInactive') includeInactive?: string) {
    return this.setup.listSessions(includeInactive === 'true');
  }

  @Post('sessions')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Create an academic session (e.g. 2026 + 2026-27)' })
  createSession(@Body() dto: CreateAcademicSessionDto) {
    return this.setup.createSession(dto);
  }

  @Patch('sessions/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Update an academic session (isCurrent moves the current flag)' })
  updateSession(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicSessionDto) {
    return this.setup.updateSession(id, dto);
  }

  @Delete('sessions/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Delete an unused session (blocked while referenced — deactivate instead)' })
  deleteSession(@Param('id', ParseUUIDPipe) id: string) {
    return this.setup.deleteSession(id);
  }

  /* ================= classes / departments ================= */

  @Get('classes')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
  @ApiOperation({ summary: 'List classes/departments (?includeInactive=true&level=SCHOOL)' })
  listClasses(@Query('includeInactive') includeInactive?: string, @Query('level') level?: string) {
    return this.setup.listClasses(includeInactive === 'true', level || undefined);
  }

  @Post('classes')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Create a class/department (e.g. Class VI + CLS-06)' })
  createClass(@Body() dto: CreateClassOrDeptDto) {
    return this.setup.createClass(dto);
  }

  @Patch('classes/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Update a class/department' })
  updateClass(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClassOrDeptDto) {
    return this.setup.updateClass(id, dto);
  }

  @Delete('classes/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Delete an unused class (blocked while referenced — deactivate instead)' })
  deleteClass(@Param('id', ParseUUIDPipe) id: string) {
    return this.setup.deleteClass(id);
  }

  /* ================= exam term types (dynamic) ================= */

  @Get('term-types')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
  @ApiOperation({ summary: 'List exam term types with their engine behavior (?includeInactive=true)' })
  listTermTypes(@Query('includeInactive') includeInactive?: string) {
    return this.setup.listTermTypes(includeInactive === 'true');
  }

  @Post('term-types')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Create an exam term type (e.g. Half-Yearly + TERMINAL behavior)' })
  createTermType(@Body() dto: CreateExamTermTypeDto) {
    return this.setup.createTermType(dto);
  }

  @Patch('term-types/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Update an exam term type' })
  updateTermType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExamTermTypeDto) {
    return this.setup.updateTermType(id, dto);
  }

  @Delete('term-types/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Delete an unused term type (built-ins and used types are protected)' })
  deleteTermType(@Param('id', ParseUUIDPipe) id: string) {
    return this.setup.deleteTermType(id);
  }

  /* ================= sections / batches (dynamic) ================= */

  @Get('sections')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
  @ApiOperation({ summary: 'List sections/batches (?includeInactive=true)' })
  listSections(@Query('includeInactive') includeInactive?: string) {
    return this.setup.listSectionOrBatches(includeInactive === 'true');
  }

  @Post('sections')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Create a section/batch (e.g. Section A + SEC-A)' })
  createSection(@Body() dto: CreateSectionOrBatchDto) {
    return this.setup.createSectionOrBatch(dto);
  }

  @Patch('sections/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Update a section/batch' })
  updateSection(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSectionOrBatchDto) {
    return this.setup.updateSectionOrBatch(id, dto);
  }

  @Delete('sections/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Delete an unused section (blocked while referenced — deactivate instead)' })
  deleteSection(@Param('id', ParseUUIDPipe) id: string) {
    return this.setup.deleteSectionOrBatch(id);
  }

  /* ================= groups (dynamic) ================= */

  @Get('groups')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
  @ApiOperation({ summary: 'List groups (?includeInactive=true)' })
  listGroups(@Query('includeInactive') includeInactive?: string) {
    return this.setup.listAcademicGroups(includeInactive === 'true');
  }

  @Post('groups')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Create a group (e.g. Science + SCI)' })
  createGroup(@Body() dto: CreateAcademicGroupDto) {
    return this.setup.createAcademicGroup(dto);
  }

  @Patch('groups/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Update a group' })
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicGroupDto) {
    return this.setup.updateAcademicGroup(id, dto);
  }

  @Delete('groups/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
  @ApiOperation({ summary: 'Delete an unused group (blocked while referenced — deactivate instead)' })
  deleteGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.setup.deleteAcademicGroup(id);
  }
}
