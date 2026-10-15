import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StudentOnboardingService } from './student-onboarding.service';
import { ConfirmAdmissionDto, FeePreviewDto } from './admissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Admissions — Onboarding (Atomic)')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions/onboarding')
export class StudentOnboardingController {
  constructor(private readonly onboarding: StudentOnboardingService) {}

  @Get('fee-suggest')
  @ApiOperation({ summary: 'Default admission fee set (ONE_TIME + SESSION + first TUITION)' })
  suggest() {
    return this.onboarding.suggestFeeItems();
  }

  @Post('fee-preview')
  @ApiOperation({ summary: 'Workflow 4 dry-run: itemized fees, waiver discounts, net payable (no writes)' })
  preview(@Body() dto: FeePreviewDto) {
    return this.onboarding.previewFee(dto);
  }

  @Post('confirm')
  @ApiOperation({
    summary:
      'Atomic admit: family → student → enrollment → subjects → waivers → invoice + GL (one txn). Add collectNow for Admit-&-Collect POS.',
  })
  confirm(@Body() dto: ConfirmAdmissionDto, @CurrentUser('id') actorId: string) {
    return this.onboarding.admit(dto, actorId);
  }
}
