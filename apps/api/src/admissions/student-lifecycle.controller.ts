import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { StudentLifecycleService } from './student-lifecycle.service';
import { IssueTcDto, PromoteStudentsDto, TransferSectionDto } from './admissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

class StudentListQuery {
  @IsOptional() @IsString() academicSessionId?: string;
  @IsOptional() @IsString() classOrDeptId?: string;
  @IsOptional() @IsString() sectionOrBatchId?: string;
  @IsOptional() @IsString() academicGroup?: string;
  @IsOptional() @IsString() quotaTag?: string;
  @IsOptional() @IsString() residenceType?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() feeDue?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() limit?: string;
}

@ApiTags('Admissions — Student Lifecycle (Directory, TC, Promotion)')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions/students')
export class StudentLifecycleController {
  constructor(private readonly lifecycle: StudentLifecycleService) {}

  @Get()
  @ApiOperation({
    summary:
      'Master student directory (?academicSessionId=&classOrDeptId=&sectionOrBatchId=&academicGroup=&quotaTag=&residenceType=&status=&feeDue=true&search=)',
  })
  list(@Query() q: StudentListQuery) {
    return this.lifecycle.listStudents({
      academicSessionId: q.academicSessionId,
      classOrDeptId: q.classOrDeptId,
      sectionOrBatchId: q.sectionOrBatchId,
      academicGroup: q.academicGroup,
      quotaTag: q.quotaTag,
      residenceType: q.residenceType,
      status: q.status,
      feeDue: q.feeDue === 'true',
      search: q.search,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Get('filter-options')
  @ApiOperation({ summary: 'Distinct session / class / section ids in active enrollments (directory filter dropdowns)' })
  filterOptions() {
    return this.lifecycle.filterOptions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Student profile: identity, family, enrollments, previous education, documents, AR balance' })
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.lifecycle.getProfile(id);
  }

  @Get(':id/clearance')
  @ApiOperation({ summary: 'TC clearance check: AR balance + caution deposits (Phase 5 gate)' })
  clearance(@Param('id', ParseUUIDPipe) id: string) {
    return this.lifecycle.clearance(id);
  }

  @Post(':id/tc')
  @ApiOperation({
    summary:
      'Issue Transfer Certificate — blocked while AR balance > 0 or caution deposits held; pass overrideReason to waive dues (audited)',
  })
  issueTc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueTcDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.lifecycle.issueTc(id, dto, actorId);
  }

  @Post(':id/transfer-section')
  @ApiOperation({ summary: 'Transfer a student to another section/shift/group (re-rolls in the new scope)' })
  transferSection(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferSectionDto) {
    return this.lifecycle.transferSection(id, dto);
  }

  @Post('promote')
  @ApiOperation({ summary: 'Bulk session promotion / readmission — retires the active enrollment, creates the new one' })
  promote(@Body() dto: PromoteStudentsDto) {
    return this.lifecycle.promote(dto);
  }
}
