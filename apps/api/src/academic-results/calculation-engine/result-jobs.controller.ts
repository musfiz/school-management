import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { ResultJobRunnerService } from './result-job-runner.service';

export class ResultTermDto {
  @IsUUID() examTermId!: string;
}

export class ResultJobParamsDto {
  @IsUUID() id!: string;
}

/**
 * Result Engine §PHASE 5 — pre-flight, job runner and snapshot generation.
 * Served under `/academic-results/calculation/*`.
 */
@ApiTags('Academic Results — Calculation')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.EXAM_CONTROLLER)
@Controller('academic-results/calculation')
export class ResultJobsController {
  constructor(private readonly runner: ResultJobRunnerService) {}

  @Get('pre-flight')
  @ApiOperation({ summary: 'CC-17/CC-19/CC-06/AD-4/AD-7 blockers for a term' })
  preflight(@Query() query: ResultTermDto) {
    return this.runner.preflight(query.examTermId);
  }

  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue a background generation job (AD-2, one active job per term)' })
  start(@Body() dto: ResultTermDto, @CurrentUser('id') actorId: string) {
    return this.runner.start(dto.examTermId, actorId);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Generation job history for a term' })
  list(@Query() query: ResultTermDto) {
    return this.runner.listForTerm(query.examTermId);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Generation job status/progress' })
  status(@Param() params: ResultJobParamsDto) {
    return this.runner.get(params.id);
  }

  @Post('run-now')
  @ApiOperation({ summary: 'Generate synchronously (small classes, tests)' })
  runNow(@Body() dto: ResultTermDto, @CurrentUser('id') actorId: string) {
    return this.runner.runNow(dto.examTermId, actorId);
  }
}
