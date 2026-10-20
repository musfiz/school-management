import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, Max, IsNumberString, IsDateString } from 'class-validator';
import { PreviousEducationService } from './previous-education.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

class PreviousEducationQuery {
  @IsOptional() @IsUUID() studentId?: string;
}

export class CreatePreviousEducationDto {
  @IsUUID() studentId!: string;
  @IsString() @MaxLength(40) examTitle!: string;
  @IsString() @MaxLength(150) instituteName!: string;
  @IsOptional() @IsString() @MaxLength(40) educationBoard?: string | null;
  @IsOptional() @IsString() @MaxLength(40) academicGroup?: string | null;
  @IsOptional() @IsString() @MaxLength(30) rollNo?: string | null;
  @IsOptional() @IsString() @MaxLength(30) regNo?: string | null;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) passingYear?: number | null;
  @IsOptional() @IsNumberString() gpaObtained?: string | null;
  @IsOptional() @IsString() @MaxLength(50) tcNumber?: string | null;
  @IsOptional() @IsDateString() tcDate?: string | null;
}

export class UpdatePreviousEducationDto {
  @IsOptional() @IsString() @MaxLength(40) examTitle?: string;
  @IsOptional() @IsString() @MaxLength(150) instituteName?: string;
  @IsOptional() @IsString() @MaxLength(40) educationBoard?: string | null;
  @IsOptional() @IsString() @MaxLength(40) academicGroup?: string | null;
  @IsOptional() @IsString() @MaxLength(30) rollNo?: string | null;
  @IsOptional() @IsString() @MaxLength(30) regNo?: string | null;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) passingYear?: number | null;
  @IsOptional() @IsNumberString() gpaObtained?: string | null;
  @IsOptional() @IsString() @MaxLength(50) tcNumber?: string | null;
  @IsOptional() @IsDateString() tcDate?: string | null;
}

/**
 * Previous-education CRUD (Plan §3.3 — student_previous_educations).
 * Served under `/admissions/previous-educations/*` so the web app's existing
 * `api/admissions/[...path]` proxy forwards it with no extra route.
 */
@ApiTags('Admissions — Previous Education')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions/previous-educations')
export class PreviousEducationController {
  constructor(private readonly service: PreviousEducationService) {}

  /** GET /admissions/previous-educations?studentId= — list rows (optionally per student). */
  @Get()
  @ApiOperation({ summary: 'List previous-education rows (?studentId=)' })
  list(@Query() q: PreviousEducationQuery) {
    return this.service.list(q.studentId);
  }

  /** POST /admissions/previous-educations — add one previous-education row. */
  @Post()
  @ApiOperation({ summary: 'Add a previous-education row for a student' })
  create(@Body() dto: CreatePreviousEducationDto) {
    return this.service.create(dto);
  }

  /** PATCH /admissions/previous-educations/:id — update one row. */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a previous-education row' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePreviousEducationDto) {
    return this.service.update(id, dto);
  }

  /** DELETE /admissions/previous-educations/:id — remove one row. */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a previous-education row' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
