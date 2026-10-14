import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollAccountingService } from './payroll.service';
import {
  AddPayslipDto,
  CreateHonorariumDto,
  CreatePayrollRunDto,
  PayHonorariumDto,
  PayPayrollRunDto,
} from './payroll.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Accounting — Payroll, MPO & Honorarium')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('accounting/payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollAccountingService) {}

  @Get('runs')
  @ApiOperation({ summary: 'List salary runs (?limit=)' })
  runs(@Query('limit') limit?: string) {
    return this.payroll.listRuns(limit ? Number(limit) : undefined);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Run detail + payslips + vouchers' })
  run(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.findRun(id);
  }

  @Post('runs')
  @ApiOperation({ summary: 'Open a DRAFT salary run for a month' })
  createRun(@Body() dto: CreatePayrollRunDto, @CurrentUser('id') actorId: string) {
    return this.payroll.createRun(dto, actorId);
  }

  @Post('runs/:id/payslips')
  @ApiOperation({ summary: 'Add a payslip (MPO shown, institutional net computed)' })
  addPayslip(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddPayslipDto) {
    return this.payroll.addPayslip(id, dto);
  }

  @Delete('runs/:runId/payslips/:slipId')
  @ApiOperation({ summary: 'Remove a payslip from a DRAFT run' })
  removePayslip(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('slipId', ParseUUIDPipe) slipId: string,
  ) {
    return this.payroll.removePayslip(runId, slipId);
  }

  @Post('runs/:id/approve')
  @ApiOperation({
    summary:
      'Approve + auto-post (MPO never posted): Dr 51101 + 51104 / Cr 22101 + 21301 + 11403 + 21102',
  })
  approveRun(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') actorId: string) {
    return this.payroll.approveRun(id, actorId);
  }

  @Post('runs/:id/pay')
  @ApiOperation({ summary: 'Disburse full net payable: Dr 21102 / Cr bank' })
  payRun(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayPayrollRunDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.payroll.payRun(id, dto, actorId);
  }

  @Delete('runs/:id')
  @ApiOperation({ summary: 'Void a DRAFT run' })
  voidRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.voidRun(id);
  }

  @Get('honoraria')
  @ApiOperation({ summary: 'List adjunct honorarium bills (?limit=)' })
  honoraria(@Query('limit') limit?: string) {
    return this.payroll.listHonoraria(limit ? Number(limit) : undefined);
  }

  @Get('honoraria/:id')
  @ApiOperation({ summary: 'Honorarium bill detail + voucher' })
  honorarium(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.findHonorarium(id);
  }

  @Post('honoraria')
  @ApiOperation({ summary: 'Enter workload bill (DRAFT): counts × rates → gross → 10–15% TDS → net' })
  createHonorarium(@Body() dto: CreateHonorariumDto, @CurrentUser('id') actorId: string) {
    return this.payroll.createHonorarium(dto, actorId);
  }

  @Post('honoraria/:id/approve')
  @ApiOperation({ summary: 'Approve + auto-post: Dr 51103 / Cr 21103 (net) + Cr 21303 (TDS)' })
  approveHonorarium(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') actorId: string) {
    return this.payroll.approveHonorarium(id, actorId);
  }

  @Post('honoraria/:id/pay')
  @ApiOperation({ summary: 'Pay honorarium in full: Dr 21103 / Cr bank' })
  payHonorarium(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayHonorariumDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.payroll.payHonorarium(id, dto, actorId);
  }

  @Delete('honoraria/:id')
  @ApiOperation({ summary: 'Void a DRAFT honorarium bill' })
  voidHonorarium(@Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.voidHonorarium(id);
  }
}
