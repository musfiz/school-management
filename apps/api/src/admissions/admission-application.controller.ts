import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { AdmissionApplicationService } from './admission-application.service';
import {
  BulkTestMarksDto,
  CollectFormFeeDto,
  CreateCampaignDto,
  SubmitApplicationDto,
  UpdateApplicationStatusDto,
  UpdateCampaignDto,
} from './admissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

class ApplicationListQuery {
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() limit?: string;
}

@ApiTags('Admissions — Campaigns & Applications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions')
export class AdmissionApplicationController {
  constructor(private readonly apps: AdmissionApplicationService) {}

  @Get('campaigns')
  @ApiOperation({ summary: 'List admission campaigns (?activeOnly=true)' })
  campaigns(@Query('activeOnly') activeOnly?: string) {
    return this.apps.listCampaigns(activeOnly === 'true');
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create a campaign (seats, eligibility GPA, window, form fee)' })
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.apps.createCampaign(dto);
  }

  @Patch('campaigns/:id')
  @ApiOperation({ summary: 'Update / close a campaign' })
  updateCampaign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampaignDto) {
    return this.apps.updateCampaign(id, dto as Record<string, unknown>);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Applicant pipeline (?campaignId=&status=&limit=)' })
  applications(@Query() q: ApplicationListQuery) {
    return this.apps.listApplications({
      campaignId: q.campaignId,
      status: q.status,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Post('applications')
  @ApiOperation({ summary: 'Submit an online / walk-in application (eligibility-gated, APP number issued)' })
  submit(@Body() dto: SubmitApplicationDto) {
    return this.apps.submit(dto);
  }

  @Patch('applications/:id/status')
  @ApiOperation({ summary: 'Shortlist / waitlist / reject (ADMITTED only via admission confirm)' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationStatusDto) {
    return this.apps.setStatus(id, dto.status);
  }

  @Post('applications/test-marks')
  @ApiOperation({ summary: 'Bulk test-marks entry + automatic competition-rank merit list' })
  testMarks(@Body() dto: BulkTestMarksDto) {
    return this.apps.bulkTestMarks(dto.campaignId, dto.marks);
  }

  @Post('applications/:id/form-fee')
  @ApiOperation({ summary: 'Collect prospectus/form fee: Dr Cash / Cr 44102 (source ADMISSION)' })
  formFee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectFormFeeDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.apps.collectFormFee(id, dto, actorId);
  }

  @Get('applications/:id/draft')
  @ApiOperation({ summary: 'Convert to admission draft: wizard pre-fill (name, DOB, GPA, quota, family query)' })
  draft(@Param('id', ParseUUIDPipe) id: string) {
    return this.apps.convertToDraft(id);
  }
}
