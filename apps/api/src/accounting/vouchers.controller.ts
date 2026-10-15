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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JournalPostingService } from './journal-posting.service';
import { CreateJournalEntryDto, UpdateJournalDraftDto } from './vouchers.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user-role.enum';

class ReverseVoucherDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

@ApiTags('Accounting — Vouchers / General Ledger')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ACCOUNTANT)
@Controller('accounting/vouchers')
export class VouchersController {
  constructor(private readonly posting: JournalPostingService) {}

  @Get()
  @ApiOperation({ summary: 'List vouchers (filter by status / type / search)' })
  findAll(
    @Query('status') status?: string,
    @Query('voucherType') voucherType?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posting.findAll({
      status,
      voucherType,
      search,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Voucher detail with lines' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.posting.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Maker: create a balanced DRAFT voucher (number auto-assigned)' })
  create(@Body() dto: CreateJournalEntryDto, @CurrentUser('id') makerId: string) {
    return this.posting.createDraft(dto, makerId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Maker: edit a DRAFT voucher (blocked once verified)' })
  updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJournalDraftDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.posting.updateDraft(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Maker: delete a DRAFT voucher (approved entries need REVERSAL)' })
  deleteDraft(@Param('id', ParseUUIDPipe) id: string) {
    return this.posting.deleteDraft(id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Checker: DRAFT → VERIFIED (checker must differ from maker)' })
  verify(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') checkerId: string) {
    return this.posting.verify(id, checkerId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approver: VERIFIED → APPROVED (immutable from here)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') approverId: string) {
    return this.posting.approve(id, approverId);
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'Approver: post a mirror REVERSAL of an APPROVED voucher' })
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseVoucherDto,
    @CurrentUser('id') approverId: string,
  ) {
    return this.posting.reverse(id, approverId, dto.reason);
  }
}
