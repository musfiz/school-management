import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdmissionDashboardService } from './admission-dashboard.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Admissions — Dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions/dashboard')
export class AdmissionDashboardController {
  constructor(private readonly dashboard: AdmissionDashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Admission dashboard: seat capacity vs admitted per campaign, application funnel, today’s admissions, pending admission fees',
  })
  overview() {
    return this.dashboard.overview();
  }
}
