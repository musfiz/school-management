import { Module } from '@nestjs/common';
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
import { FinancialReportsService } from './financial-reports.service';
import { ReportsController } from './reports.controller';
import { AccountingAuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [],
  controllers: [
    ChartOfAccountsController,
    VouchersController,
    BillingController,
    CollectionController,
    ProcurementController,
    PayrollController,
    ReportsController,
    AuditController,
  ],
  providers: [
    ChartOfAccountsService,
    VoucherSequenceService,
    JournalPostingService,
    StudentBillingService,
    FeeCollectionService,
    VendorBillService,
    PayrollAccountingService,
    FinancialReportsService,
    AccountingAuditService,
  ],
  exports: [
    ChartOfAccountsService,
    JournalPostingService,
    VoucherSequenceService,
    StudentBillingService,
    FeeCollectionService,
    VendorBillService,
    PayrollAccountingService,
    FinancialReportsService,
    AccountingAuditService,
  ],
})
export class AccountingModule {}
