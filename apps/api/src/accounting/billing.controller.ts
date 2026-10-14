import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { StudentBillingService } from './student-billing.service';
import {
  ApplyLateFineDto,
  BulkInvoiceDto,
  CreateCautionDepositDto,
  CreateFeeHeadDto,
  CreateInvoiceDto,
  CreateWaiverDto,
  SettleCautionDepositDto,
  UpdateFeeHeadDto,
  UpdateWaiverDto,
} from './billing.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

class ReverseInvoiceDto {
  @IsString() reason!: string;
}

class AdvanceDto {
  @IsUUID() studentId!: string;
  @IsNumberString() amount!: string;
  @IsOptional() @IsUUID() cashGlId?: string | null;
  @IsOptional() @IsUUID() fundId?: string | null;
  @IsOptional() @IsUUID() costCenterId?: string | null;
  @IsOptional() @IsString() memo?: string;
}

@ApiTags('Accounting — Billing & Invoices')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('accounting/billing')
export class BillingController {
  constructor(private readonly billing: StudentBillingService) {}

  /* ---------------- fee heads ---------------- */

  @Get('fee-heads')
  @ApiOperation({ summary: 'List fee heads (revenue-GL mapped catalogue)' })
  heads(@Query('activeOnly') activeOnly?: string) {
    return this.billing.listHeads(activeOnly === 'true');
  }

  @Post('fee-heads')
  @ApiOperation({ summary: 'Create a fee head mapped to a revenue / caution GL' })
  createHead(@Body() dto: CreateFeeHeadDto) {
    return this.billing.createHead(dto);
  }

  @Patch('fee-heads/:id')
  @ApiOperation({ summary: 'Update a fee head' })
  updateHead(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFeeHeadDto) {
    return this.billing.updateHead(id, dto);
  }

  @Delete('fee-heads/:id')
  @ApiOperation({ summary: 'Delete an unused fee head (blocked once it has billed)' })
  deleteHead(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.deleteHead(id);
  }

  @Post('fee-heads/seed-defaults')
  @ApiOperation({ summary: 'Seed standard BD fee catalogue (TUITION/EXAM/HOSTEL/CAUTION…)' })
  seedDefaults() {
    return this.billing.seedDefaults();
  }

  /* ---------------- waivers ---------------- */

  @Get('waivers')
  @ApiOperation({ summary: 'List waivers (optional ?studentId=)' })
  waivers(@Query('studentId') studentId?: string) {
    return this.billing.listWaivers(studentId);
  }

  @Post('waivers')
  @ApiOperation({ summary: 'Grant a waiver (percent + optional cap, contra 41901–41904)' })
  createWaiver(@Body() dto: CreateWaiverDto) {
    return this.billing.createWaiver(dto);
  }

  @Patch('waivers/:id')
  @ApiOperation({ summary: 'Update / deactivate a waiver' })
  updateWaiver(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWaiverDto) {
    return this.billing.updateWaiver(id, dto);
  }

  /* ---------------- invoices ---------------- */

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices (?studentId=&status=&period=&limit=)' })
  invoices(
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billing.listInvoices({
      studentId,
      status,
      period,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Invoice detail with lines + accrual journal' })
  invoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.findInvoice(id);
  }

  @Post('invoices')
  @ApiOperation({
    summary: 'Generate one invoice — gross→waiver→net + auto-posted accrual journal',
  })
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser('id') actorId: string) {
    return this.billing.createInvoice(dto, actorId);
  }

  @Post('invoices/bulk')
  @ApiOperation({ summary: 'Bulk-generate one billing period for many students' })
  bulk(@Body() dto: BulkInvoiceDto, @CurrentUser('id') actorId: string) {
    return this.billing.bulkGenerate(dto, actorId);
  }

  @Post('invoices/:id/reverse')
  @ApiOperation({ summary: 'Reverse an unpaid invoice (offsetting STUDENT_BILLING journal)' })
  reverseInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseInvoiceDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.billing.reverseInvoice(id, actorId, dto.reason);
  }

  @Post('invoices/:id/late-fine')
  @ApiOperation({ summary: 'Post a late fine: Dr 11401 AR / Cr 42103' })
  lateFine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyLateFineDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.billing.applyLateFine(id, dto, actorId);
  }

  @Post('late-fine-sweep')
  @ApiOperation({ summary: 'Fine every overdue invoice (cron + manual trigger)' })
  sweep(
    @Body() body: { flatFine?: string; asOf?: string },
    @CurrentUser('id') actorId: string,
  ) {
    return this.billing.lateFineSweep(actorId, body?.flatFine ?? '200.00', body?.asOf);
  }

  /* ---------------- ledger & dues ---------------- */

  @Get('ledger/:studentId')
  @ApiOperation({ summary: 'Student ledger: invoices + cautions + AR balance' })
  ledger(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.billing.studentLedger(studentId);
  }

  @Get('dues/aging')
  @ApiOperation({ summary: 'Defaulter aging buckets 0–30 / 31–60 / 61–90 / 90+' })
  aging(@Query('asOf') asOf?: string) {
    return this.billing.duesAging(asOf);
  }

  /* ---------------- caution deposits ---------------- */

  @Get('cautions')
  @ApiOperation({ summary: 'List caution deposits (optional ?studentId=)' })
  cautions(@Query('studentId') studentId?: string) {
    return this.billing.listCautions(studentId);
  }

  @Post('cautions')
  @ApiOperation({ summary: 'Collect a caution deposit: Dr Cash / Cr 21401 (STUDENT sub-ledger)' })
  collectCaution(@Body() dto: CreateCautionDepositDto, @CurrentUser('id') actorId: string) {
    return this.billing.collectCaution(dto, actorId);
  }

  @Post('cautions/:id/settle')
  @ApiOperation({ summary: 'Settle a deposit: ADJUSTED to dues or REFUNDED in cash' })
  settleCaution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleCautionDepositDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.billing.settleCaution(id, dto, actorId);
  }

  /* ---------------- advances (21201) ---------------- */

  @Post('advances')
  @ApiOperation({ summary: 'Record advance tuition: Dr Cash / Cr 21201' })
  advance(@Body() dto: AdvanceDto, @CurrentUser('id') actorId: string) {
    return this.billing.recordAdvance(dto.studentId, dto.amount, actorId, {
      cashGlId: dto.cashGlId ?? undefined,
      fundId: dto.fundId ?? undefined,
      costCenterId: dto.costCenterId ?? undefined,
      memo: dto.memo,
    });
  }
}
