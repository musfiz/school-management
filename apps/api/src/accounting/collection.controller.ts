import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeeCollectionService } from './fee-collection.service';
import {
  CollectFeeDto,
  MfsWebhookDto,
  ReverseCollectionDto,
  SettleCollectionDto,
} from './collection.dto';
import { MFS_CHANNELS } from '../database/entities/payment-collection.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

@ApiTags('Accounting — Fee Collection (POS / MFS)')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('accounting/collection')
export class CollectionController {
  constructor(private readonly collection: FeeCollectionService) {}

  @Get('receipts')
  @ApiOperation({ summary: 'List money receipts (?studentId=&status=&channel=&limit=)' })
  receipts(
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.collection.list({
      studentId,
      status,
      channel,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Money receipt detail + RECEIVE voucher' })
  receipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.collection.findOne(id);
  }

  @Get('dues/:studentId')
  @ApiOperation({ summary: 'POS lookup: open invoices + total due for one student' })
  dues(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.collection.duesForStudent(studentId);
  }

  @Post('collect')
  @ApiOperation({
    summary:
      'Counter collection: full/partial vs one invoice — Dr Cash/Bank (or 1130x net + 54103 TDR) / Cr 11401 AR',
  })
  collect(@Body() dto: CollectFeeDto, @CurrentUser('id') actorId: string) {
    return this.collection.collect(dto, actorId);
  }

  @Post('webhook/:gateway')
  @ApiOperation({
    summary: `MFS auto-post (idempotent on gateway_trx_id): ${MFS_CHANNELS.join('/')}`,
  })
  webhook(
    @Param('gateway') gateway: string,
    @Body() dto: MfsWebhookDto,
    @CurrentUser('id') actorId: string,
  ) {
    const ch = gateway.trim().toUpperCase();
    if (!MFS_CHANNELS.includes(ch as (typeof MFS_CHANNELS)[number])) {
      return Promise.reject(new Error(`Unknown gateway "${gateway}" — use ${MFS_CHANNELS.join(', ')}`));
    }
    return this.collection.webhook(ch as (typeof MFS_CHANNELS)[number], dto, actorId);
  }

  @Post('receipts/:id/settle')
  @ApiOperation({ summary: 'Settle MFS clearing → mother bank: Dr 11201 / Cr 1130x (CONTRA)' })
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleCollectionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.collection.settle(id, dto, actorId);
  }

  @Post('receipts/:id/reverse')
  @ApiOperation({ summary: 'Reverse a receipt (offsetting MFS_COLLECTION journal + AR rollback)' })
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseCollectionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.collection.reverse(id, dto.reason, actorId);
  }
}
