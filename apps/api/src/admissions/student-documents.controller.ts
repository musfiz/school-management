import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { StudentDocumentsService } from './student-documents.service';
import {
  UpdateStudentDocumentDto,
  UpsertStudentDocumentDto,
  VerifyStudentDocumentDto,
} from './admissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

class DocumentSummaryQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() onlyPending?: string;
  @IsOptional() @IsString() limit?: string;
}

@ApiTags('Admissions — Documents & Verification')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions/documents')
export class StudentDocumentsController {
  constructor(private readonly documents: StudentDocumentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Verification queue — per-student document counts (?search=&onlyPending=true&limit=)',
  })
  summary(@Query() q: DocumentSummaryQuery) {
    return this.documents.summary({
      search: q.search,
      onlyPending: q.onlyPending === 'true',
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Get('types')
  @ApiOperation({ summary: 'Canonical document type codes (Plan §3.5)' })
  types() {
    return this.documents.types();
  }

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Per-student document checklist (rows + canonical type list)' })
  list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.documents.listForStudent(studentId);
  }

  @Post('student/:studentId')
  @ApiOperation({ summary: 'Add or replace a student document (re-upload clears verification)' })
  upsert(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: UpsertStudentDocumentDto,
  ) {
    return this.documents.upsert(studentId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a document (swap file / toggle original-submitted)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDocumentDto) {
    return this.documents.update(id, dto);
  }

  @Patch(':id/verify')
  @ApiOperation({ summary: 'Verify / unverify a document (stamps verified_by)' })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyStudentDocumentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.documents.setVerified(id, dto.verified, actorId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a document from the checklist' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(id);
  }
}
