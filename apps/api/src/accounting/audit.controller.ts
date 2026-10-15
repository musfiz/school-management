import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';
import { AccountingAuditService } from './audit.service';
import { AuditLogQueryDto, VoucherAuditQueryDto } from './audit.dto';

@ApiTags('Accounting — Audit Trail & Governance')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('accounting/audit')
export class AuditController {
  constructor(private readonly auditService: AccountingAuditService) {}

  @Get('vouchers')
  @ApiOperation({ summary: 'Maker-Checker-Approver voucher lifecycle audit trail' })
  getVouchers(@Query() query: VoucherAuditQueryDto) {
    return this.auditService.getVoucherAuditTrail(query);
  }

  @Get('reversals')
  @ApiOperation({ summary: 'Immutable reversal registry & reason log (spec §1.7)' })
  getReversals() {
    return this.auditService.getReversalRegistry();
  }

  @Get('source-modules')
  @ApiOperation({ summary: 'Automated vs manual double-entry postings by module' })
  getSourceModules() {
    return this.auditService.getSourceModuleSummary();
  }

  @Get('summary')
  @ApiOperation({ summary: 'High-level audit KPI metrics & compliance score' })
  getSummary() {
    return this.auditService.getAuditSummary();
  }

  @Get('logs')
  @ApiOperation({ summary: 'System audit event logs & chronological activity stream' })
  getActivityLogs(@Query() query: AuditLogQueryDto) {
    return this.auditService.getActivityLogs(query);
  }
}
