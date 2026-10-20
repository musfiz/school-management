import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LookupsService } from './lookups.service';
import { LookupsScopeQueryDto } from './lookups.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../database/entities/user-role.enum';

/**
 * Result Engine AD-3 — scope lookups derived from existing enrollment data.
 * Served under `/academic-results/lookups/*` (proxied by the web app's
 * `api/academic-results/[...path]` catch-all).
 *
 * Read-only, so `TEACHER` is included alongside the controller roles.
 */
@ApiTags('Academic Results — Lookups')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
@Controller('academic-results/lookups')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Distinct academic sessions present in syllabus / enrollment data' })
  sessions() {
    return this.lookups.sessions();
  }

  @Get('classes')
  @ApiOperation({ summary: 'Distinct classes/departments present in syllabus / enrollment data (?academicSessionId=)' })
  classes(@Query() q: LookupsScopeQueryDto) {
    return this.lookups.classes(q.academicSessionId);
  }

  @Get('sections')
  @ApiOperation({
    summary: 'Distinct sections/batches present in active enrollments (?academicSessionId=&classOrDeptId=)',
  })
  sections(@Query() q: LookupsScopeQueryDto) {
    return this.lookups.sections(q.academicSessionId, q.classOrDeptId);
  }

  @Get('scope')
  @ApiOperation({ summary: 'Combined { sessions, classes, sections } scope options for filter dropdowns' })
  scope(@Query() q: LookupsScopeQueryDto) {
    return this.lookups.scope(q.academicSessionId, q.classOrDeptId);
  }
}
