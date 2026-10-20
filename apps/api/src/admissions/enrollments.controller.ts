import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StudentLifecycleService } from './student-lifecycle.service';
import { PeekRollDto } from './admissions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Admissions — Enrollments (Sections & Roll)')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('admissions/enrollments')
export class EnrollmentsController {
  constructor(private readonly lifecycle: StudentLifecycleService) {}

  /** POST /admissions/enrollments/peek-roll — read-only preview of the next roll in a scope. */
  @Post('peek-roll')
  @ApiOperation({ summary: 'Preview the next class roll number for (session, class, section) without consuming it.' })
  peekRoll(@Body() dto: PeekRollDto) {
    return this.lifecycle.peekRoll(dto);
  }
}
