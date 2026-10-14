import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fund } from '../database/entities/fund.entity';
import { CostCenter } from '../database/entities/cost-center.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { FiscalPeriod } from '../database/entities/fiscal-period.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalLine } from '../database/entities/journal-line.entity';
import { VoucherSequence } from '../database/entities/voucher-sequence.entity';
import { User } from '../database/entities/user.entity';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { VoucherSequenceService } from './voucher-sequence.service';
import { JournalPostingService } from './journal-posting.service';
import { VouchersController } from './vouchers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Fund,
      CostCenter,
      ChartOfAccount,
      FiscalPeriod,
      JournalEntry,
      JournalLine,
      VoucherSequence,
      User,
    ]),
  ],
  controllers: [ChartOfAccountsController, VouchersController],
  providers: [ChartOfAccountsService, VoucherSequenceService, JournalPostingService],
  exports: [ChartOfAccountsService, JournalPostingService, VoucherSequenceService],
})
export class AccountingModule {}
