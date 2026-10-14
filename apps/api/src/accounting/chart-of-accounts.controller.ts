import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import {
  CreateFundDto,
  UpdateFundDto,
  CreateCostCenterDto,
  UpdateCostCenterDto,
  CreateAccountDto,
  UpdateAccountDto,
  CreateFiscalPeriodDto,
  UpdateFiscalPeriodDto,
} from './chart-of-accounts.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Accounting — Chart of Accounts')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT)
@Controller('accounting')
export class ChartOfAccountsController {
  constructor(private readonly coaService: ChartOfAccountsService) {}

  /* ---------------- Funds ---------------- */

  @Get('funds')
  @ApiOperation({ summary: 'List all funds (ordered by code)' })
  findAllFunds() {
    return this.coaService.findAllFunds();
  }

  @Post('funds')
  @ApiOperation({ summary: 'Create a fund' })
  createFund(@Body() dto: CreateFundDto) {
    return this.coaService.createFund(dto);
  }

  @Patch('funds/:id')
  @ApiOperation({ summary: 'Update a fund by ID' })
  updateFund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFundDto) {
    return this.coaService.updateFund(id, dto);
  }

  /* ---------------- Cost centers ---------------- */

  @Get('cost-centers')
  @ApiOperation({ summary: 'List all cost centers (ordered by code)' })
  findAllCostCenters() {
    return this.coaService.findAllCostCenters();
  }

  @Post('cost-centers')
  @ApiOperation({ summary: 'Create a cost center' })
  createCostCenter(@Body() dto: CreateCostCenterDto) {
    return this.coaService.createCostCenter(dto);
  }

  @Patch('cost-centers/:id')
  @ApiOperation({ summary: 'Update a cost center by ID' })
  updateCostCenter(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCostCenterDto) {
    return this.coaService.updateCostCenter(id, dto);
  }

  /* ---------------- Chart of accounts ---------------- */

  @Get('chart-of-accounts')
  @ApiOperation({ summary: 'List all GL accounts flat (ordered by code)' })
  findAllAccounts(@Query('activeOnly') activeOnly?: string) {
    return this.coaService.findAllAccounts(activeOnly === 'true');
  }

  @Get('chart-of-accounts/tree')
  @ApiOperation({ summary: 'List GL accounts as a nested tree for the CoA viewer' })
  accountsTree() {
    return this.coaService.accountsTree();
  }

  @Post('chart-of-accounts')
  @ApiOperation({ summary: 'Create a GL account' })
  createAccount(@Body() dto: CreateAccountDto) {
    return this.coaService.createAccount(dto);
  }

  @Patch('chart-of-accounts/:id')
  @ApiOperation({ summary: 'Update a GL account by ID' })
  updateAccount(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto) {
    return this.coaService.updateAccount(id, dto);
  }

  @Delete('chart-of-accounts/:id')
  @ApiOperation({ summary: 'Delete a GL account (blocked when it has children)' })
  removeAccount(@Param('id', ParseUUIDPipe) id: string) {
    return this.coaService.removeAccount(id);
  }

  /* ---------------- Fiscal periods ---------------- */

  @Get('fiscal-periods')
  @ApiOperation({ summary: 'List all fiscal periods (newest first)' })
  findAllPeriods() {
    return this.coaService.findAllPeriods();
  }

  @Post('fiscal-periods')
  @ApiOperation({ summary: 'Create a fiscal period' })
  createPeriod(@Body() dto: CreateFiscalPeriodDto) {
    return this.coaService.createPeriod(dto);
  }

  @Patch('fiscal-periods/:id')
  @ApiOperation({ summary: 'Update an open fiscal period by ID' })
  updatePeriod(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFiscalPeriodDto) {
    return this.coaService.updatePeriod(id, dto);
  }

  @Patch('fiscal-periods/:id/close')
  @ApiOperation({ summary: 'Close a fiscal period (blocks future postings)' })
  closePeriod(@Param('id', ParseUUIDPipe) id: string) {
    return this.coaService.setPeriodClosed(id, true);
  }

  @Patch('fiscal-periods/:id/reopen')
  @ApiOperation({ summary: 'Reopen a closed fiscal period' })
  reopenPeriod(@Param('id', ParseUUIDPipe) id: string) {
    return this.coaService.setPeriodClosed(id, false);
  }
}
