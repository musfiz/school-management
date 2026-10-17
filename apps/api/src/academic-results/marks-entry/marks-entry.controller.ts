import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarksEntryService } from './marks-entry.service';
import {
  AttendanceQueryDto,
  AutoPopulateDto,
  BulkComponentMarksDto,
  ImportMarksDto,
  MarksSheetQueryDto,
  SetAttendanceDto,
} from './marks-entry.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user-role.enum';

/**
 * Result Engine §PHASE 4 — marks entry, attendance auto-pull & CSV/OMR import.
 * Served under `/academic-results/marks-entry/*`. Teachers may enter marks.
 */
@ApiTags('Academic Results — Marks Entry')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER, UserRole.TEACHER)
@Controller('academic-results/marks-entry')
export class MarksEntryController {
  constructor(private readonly marksEntry: MarksEntryService) {}

  @Get('sheet')
  @ApiOperation({ summary: 'Marks-entry sheet: roster × component columns with converted preview' })
  sheet(@Query() q: MarksSheetQueryDto) {
    return this.marksEntry.getMarksEntrySheet(q.examTermId, q.syllabusSubjectId, q.sectionOrBatchId);
  }

  @Post('marks/bulk')
  @ApiOperation({ summary: 'Upsert component marks in one transaction (CC-16 validated, converted server-side)' })
  bulkMarks(@Body() dto: BulkComponentMarksDto, @CurrentUser('id') actorId: string) {
    return this.marksEntry.bulkUpsertComponentMarks(dto, actorId);
  }

  @Post('auto-populate')
  @ApiOperation({ summary: 'Populate AUTO_FROM_SUB_EXAMS (CC-06) and AUTO_FROM_ATTENDANCE (AD-4) components' })
  autoPopulate(@Body() dto: AutoPopulateDto, @CurrentUser('id') actorId: string) {
    return this.marksEntry.autoPopulateSubExamAndAttendanceMarks(dto, actorId);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import marks from CSV/OMR (dry-run diff by default; set commit=true to save)' })
  importMarks(
    @Body() dto: ImportMarksDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('id') actorId: string,
  ) {
    const csv = file?.buffer ? file.buffer.toString('utf8') : dto.csv;
    if (!csv) throw new BadRequestException('Provide a CSV file (field "file") or a "csv" body field');
    return this.marksEntry.importMarks(dto, csv, actorId);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'List a term’s attendance summaries (?examTermId=)' })
  listAttendance(@Query() q: AttendanceQueryDto) {
    return this.marksEntry.listAttendance(q.examTermId);
  }

  @Put('attendance')
  @ApiOperation({ summary: 'Manual attendance-percentage entry for a term (AD-4)' })
  setAttendance(@Body() dto: SetAttendanceDto) {
    return this.marksEntry.setAttendance(dto);
  }
}
