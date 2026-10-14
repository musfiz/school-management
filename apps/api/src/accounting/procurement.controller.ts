import {
  BadRequestException,
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
import { VendorBillService } from './vendor-bill.service';
import {
  CreateTaxChallanDto,
  CreateVendorBillDto,
  CreateVendorDto,
  PayVendorBillDto,
} from './procurement.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Accounting — Procurement, Payables & NBR Tax')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('accounting/procurement')
export class ProcurementController {
  constructor(private readonly procurement: VendorBillService) {}

  @Get('vendors')
  @ApiOperation({ summary: 'List vendors (?activeOnly=false)' })
  vendors(@Query('activeOnly') activeOnly?: string) {
    return this.procurement.listVendors(activeOnly !== 'false');
  }

  @Post('vendors')
  @ApiOperation({ summary: 'Create a supplier / contractor' })
  createVendor(@Body() dto: CreateVendorDto) {
    return this.procurement.createVendor(dto);
  }

  @Get('bills')
  @ApiOperation({ summary: 'List vendor bills (?vendorId=&status=&limit=)' })
  bills(
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.procurement.listBills({
      vendorId,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('bills/:id')
  @ApiOperation({ summary: 'Vendor bill detail + approval voucher' })
  bill(@Param('id', ParseUUIDPipe) id: string) {
    return this.procurement.findBill(id);
  }

  @Post('bills')
  @ApiOperation({
    summary:
      'Enter a supplier bill (DRAFT): gross → TDS → VDS → net payable computed, nothing posted',
  })
  createBill(@Body() dto: CreateVendorBillDto, @CurrentUser('id') actorId: string) {
    return this.procurement.createBill(dto, actorId);
  }

  @Post('bills/:id/approve')
  @ApiOperation({
    summary:
      'Approve + auto-post: Dr 5xxxx/121xx (gross) / Cr 21101 AP (net) + Cr 21302 TDS + Cr 21304 VDS',
  })
  approveBill(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') actorId: string) {
    return this.procurement.approveBill(id, actorId);
  }

  @Post('bills/:id/pay')
  @ApiOperation({ summary: 'Pay vendor full/partial: Dr 21101 AP / Cr cash-bank' })
  payBill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayVendorBillDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.procurement.payBill(id, dto, actorId);
  }

  @Delete('bills/:id')
  @ApiOperation({ summary: 'Void a DRAFT bill (posted bills correct via reversal)' })
  voidBill(@Param('id', ParseUUIDPipe) id: string) {
    return this.procurement.voidBill(id);
  }

  @Get('taxes/pending')
  @ApiOperation({ summary: 'Withheld TDS/VDS legs not yet deposited (?taxType=TDS|VDS)' })
  pendingTaxes(@Query('taxType') taxType?: string) {
    if (taxType && taxType !== 'TDS' && taxType !== 'VDS') {
      throw new BadRequestException('taxType must be TDS or VDS');
    }
    return this.procurement.pendingTaxes(taxType as 'TDS' | 'VDS' | undefined);
  }

  @Get('challans')
  @ApiOperation({ summary: 'Treasury challan register (?limit=)' })
  challans(@Query('limit') limit?: string) {
    return this.procurement.listChallans(limit ? Number(limit) : undefined);
  }

  @Get('challans/:id')
  @ApiOperation({ summary: 'Challan detail + remittance voucher' })
  challan(@Param('id', ParseUUIDPipe) id: string) {
    return this.procurement.findChallan(id);
  }

  @Post('challans')
  @ApiOperation({
    summary:
      'Deposit withheld legs under one Treasury challan: Dr 21302/21304 / Cr 11201 bank',
  })
  remit(@Body() dto: CreateTaxChallanDto, @CurrentUser('id') actorId: string) {
    return this.procurement.remitChallan(dto, actorId);
  }
}
