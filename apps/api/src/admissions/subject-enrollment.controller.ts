import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { SubjectEnrollmentService } from './subject-enrollment.service';
import {
  CreateMasterSubjectDto,
  EnrollSubjectsDto,
  SubjectPreviewQueryDto,
  UpsertSyllabusRowDto,
} from './admissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

class BoardStreamQuery {
  @IsOptional() @IsString() boardStream?: string;
}

class StudentSessionQuery {
  @IsUUID() studentId!: string;
  @IsOptional() @IsString() academicSessionId?: string;
}

class RollPreviewQuery {
  @IsUUID() academicSessionId!: string;
  @IsUUID() classOrDeptId!: string;
  @IsOptional() @IsString() sectionOrBatchId?: string;
}

@ApiTags('Admissions — Subject Enrollment')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions')
export class SubjectEnrollmentController {
  constructor(private readonly subjects: SubjectEnrollmentService) {}

  @Get('subjects/master')
  @ApiOperation({ summary: 'List master subjects (optional ?boardStream=)' })
  masters(@Query() q: BoardStreamQuery) {
    return this.subjects.listMasterSubjects(q.boardStream);
  }

  @Post('subjects/master')
  @ApiOperation({ summary: 'Create a master subject (shared catalogue with Result Engine)' })
  createMaster(@Body() dto: CreateMasterSubjectDto) {
    return this.subjects.createMasterSubject(dto);
  }

  @Get('syllabus')
  @ApiOperation({ summary: 'List syllabus matrix rows for a session + class' })
  syllabus(@Query() q: SubjectPreviewQueryDto) {
    return this.subjects.listSyllabus(q.academicSessionId, q.classOrDeptId);
  }

  @Post('syllabus')
  @ApiOperation({ summary: 'Upsert one syllabus matrix row (role, paper merge, credits)' })
  upsertRow(@Body() dto: UpsertSyllabusRowDto) {
    return this.subjects.upsertSyllabusRow(dto);
  }

  @Delete('syllabus/:id')
  @ApiOperation({ summary: 'Delete an unused syllabus row (blocked once students enrolled)' })
  removeRow(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjects.removeSyllabusRow(id);
  }

  @Get('syllabus/preview')
  @ApiOperation({ summary: 'Workflow 3: locked compulsory + group electives + 4th-optional picker for Step 3' })
  preview(@Query() q: SubjectPreviewQueryDto) {
    return this.subjects.preview(q.academicSessionId, q.classOrDeptId, q.academicGroup);
  }

  @Post('subject-enrollments')
  @ApiOperation({ summary: 'Enroll an admitted student in subjects (exactly-1 fourth-subject rule enforced)' })
  enroll(@Body() dto: EnrollSubjectsDto) {
    return this.subjects.enroll(dto.studentId, dto.academicSessionId, dto.syllabusSubjectIds);
  }

  @Get('subject-enrollments')
  @ApiOperation({ summary: 'List a student’s subject enrollments (?studentId=&academicSessionId=)' })
  studentEnrollments(@Query() q: StudentSessionQuery) {
    return this.subjects.listStudentEnrollments(q.studentId, q.academicSessionId);
  }

  @Get('roll-preview')
  @ApiOperation({ summary: 'Step-3 advisory roll preview (max+1; final roll locked at confirm)' })
  rollPreview(@Query() q: RollPreviewQuery) {
    return this.subjects.peekRoll(q.academicSessionId, q.classOrDeptId, q.sectionOrBatchId);
  }
}
