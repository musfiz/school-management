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
import { FeeHead } from '../database/entities/fee-head.entity';
import { StudentWaiver } from '../database/entities/student-waiver.entity';
import { StudentInvoice } from '../database/entities/student-invoice.entity';
import { StudentInvoiceLine } from '../database/entities/student-invoice-line.entity';
import { StudentCautionDeposit } from '../database/entities/student-caution-deposit.entity';
import { PaymentCollection } from '../database/entities/payment-collection.entity';
import { Vendor } from '../database/entities/vendor.entity';
import { VendorBill } from '../database/entities/vendor-bill.entity';
import { TaxChallan } from '../database/entities/tax-challan.entity';
import { TaxChallanItem } from '../database/entities/tax-challan-item.entity';
import { PayrollRun } from '../database/entities/payroll-run.entity';
import { PayslipLine } from '../database/entities/payslip-line.entity';
import { AdjunctHonorariumBill } from '../database/entities/adjunct-honorarium-bill.entity';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { VoucherSequenceService } from './voucher-sequence.service';
import { JournalPostingService } from './journal-posting.service';
import { VouchersController } from './vouchers.controller';
import { StudentBillingService } from './student-billing.service';
import { BillingController } from './billing.controller';
import { FeeCollectionService } from './fee-collection.service';
import { CollectionController } from './collection.controller';
import { VendorBillService } from './vendor-bill.service';
import { ProcurementController } from './procurement.controller';
import { PayrollAccountingService } from './payroll.service';
import { PayrollController } from './payroll.controller';

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
      FeeHead,
      StudentWaiver,
      StudentInvoice,
      StudentInvoiceLine,
      StudentCautionDeposit,
      PaymentCollection,
      Vendor,
      VendorBill,
      TaxChallan,
      TaxChallanItem,
      PayrollRun,
      PayslipLine,
      AdjunctHonorariumBill,
    ]),
  ],
  controllers: [ChartOfAccountsController, VouchersController, BillingController, CollectionController, ProcurementController, PayrollController],
  providers: [ChartOfAccountsService, VoucherSequenceService, JournalPostingService, StudentBillingService, FeeCollectionService, VendorBillService, PayrollAccountingService],
  exports: [ChartOfAccountsService, JournalPostingService, VoucherSequenceService, StudentBillingService, FeeCollectionService, VendorBillService, PayrollAccountingService],
})
export class AccountingModule {}
