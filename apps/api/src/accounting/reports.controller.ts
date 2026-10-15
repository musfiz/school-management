import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';
import { FinancialReportsService } from './financial-reports.service';
import {
  BalanceSheetQueryDto,
  DateRangeReportDto,
  DefaulterAgingQueryDto,
  GeneralLedgerQueryDto,
} from './reports.dto';

@ApiTags('Accounting — Statutory & Financial Reports')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('accounting/reports')
export class ReportsController {
  constructor(private readonly reportsService: FinancialReportsService) {}

  @Get('trial-balance')
  @ApiOperation({ summary: 'Trial Balance: Dr == Cr verification per GL account' })
  getTrialBalance(@Query() query: DateRangeReportDto) {
    return this.reportsService.getTrialBalance(query);
  }

  @Get('receipts-payments')
  @ApiOperation({
    summary: 'DIA Receipts & Payments Account (Cash Basis Extractor with reconciliation)',
  })
  getReceiptsAndPayments(@Query() query: DateRangeReportDto) {
    return this.reportsService.getReceiptsAndPayments(query);
  }

  @Get('income-expenditure')
  @ApiOperation({ summary: 'Statement of Income & Expenditure (Accrual P&L per fund/center)' })
  getIncomeAndExpenditure(@Query() query: DateRangeReportDto) {
    return this.reportsService.getIncomeAndExpenditure(query);
  }

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Statement of Financial Position (Balance Sheet per fund)' })
  getBalanceSheet(@Query() query: BalanceSheetQueryDto) {
    return this.reportsService.getBalanceSheet(query);
  }

  @Get('defaulter-aging')
  @ApiOperation({
    summary: 'Student Defaulter & Aging analysis (0–30, 31–60, 61–90, 90+ days overdue)',
  })
  getDefaulterAging(@Query() query: DefaulterAgingQueryDto) {
    return this.reportsService.getDefaulterAging(query);
  }

  @Get('general-ledger')
  @ApiOperation({ summary: 'General Ledger / Account Statement with running balance' })
  getGeneralLedger(@Query() query: GeneralLedgerQueryDto) {
    return this.reportsService.getGeneralLedger(query);
  }
}
