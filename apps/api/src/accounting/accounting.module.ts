import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fund } from '../database/entities/fund.entity';
import { CostCenter } from '../database/entities/cost-center.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { FiscalPeriod } from '../database/entities/fiscal-period.entity';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { ChartOfAccountsController } from './chart-of-accounts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Fund, CostCenter, ChartOfAccount, FiscalPeriod])],
  controllers: [ChartOfAccountsController],
  providers: [ChartOfAccountsService],
  exports: [ChartOfAccountsService],
})
export class AccountingModule {}
