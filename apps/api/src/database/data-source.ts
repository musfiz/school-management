import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './entities/user.entity';
import { RequiredDocumentRule } from "./entities/required-document-rule.entity";
import { MenuItem } from './entities/menu-item.entity';
import { SiteSetting } from './entities/site-setting.entity';
import { Page } from './entities/page.entity';
import { GoverningBodyMember } from './entities/governing-body-member.entity';
import { ExPrincipal } from './entities/ex-principal.entity';
import { Slider } from './entities/slider.entity';
import { StaffMember } from './entities/staff-member.entity';
import { Teacher } from './entities/teacher.entity';
import { Permission } from './entities/permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { Module } from './entities/module.entity';
import { HeroSection } from './entities/hero-section.entity';
import { Notice } from './entities/notice.entity';
import { Fund } from './entities/fund.entity';
import { CostCenter } from './entities/cost-center.entity';
import { ChartOfAccount } from './entities/chart-of-account.entity';
import { FiscalPeriod } from './entities/fiscal-period.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { VoucherSequence } from './entities/voucher-sequence.entity';
import { FeeHead } from './entities/fee-head.entity';
import { StudentWaiver } from './entities/student-waiver.entity';
import { StudentInvoice } from './entities/student-invoice.entity';
import { StudentInvoiceLine } from './entities/student-invoice-line.entity';
import { StudentCautionDeposit } from './entities/student-caution-deposit.entity';
import { PaymentCollection } from './entities/payment-collection.entity';
import { Vendor } from './entities/vendor.entity';
import { VendorBill } from './entities/vendor-bill.entity';
import { TaxChallan } from './entities/tax-challan.entity';
import { TaxChallanItem } from './entities/tax-challan-item.entity';
import { PayrollRun } from './entities/payroll-run.entity';
import { PayslipLine } from './entities/payslip-line.entity';
import { AdjunctHonorariumBill } from './entities/adjunct-honorarium-bill.entity';
import { AccountingAuditLog } from './entities/accounting-audit-log.entity';
import { AdmissionCampaign } from './entities/admission-campaign.entity';
import { AdmissionApplication } from './entities/admission-application.entity';
import { FamilyProfile } from './entities/family-profile.entity';
import { Student } from './entities/student.entity';
import { StudentPreviousEducation } from './entities/student-previous-education.entity';
import { StudentEnrollment } from './entities/student-enrollment.entity';
import { StudentDocument } from './entities/student-document.entity';
import { WaiverPresetRule } from './entities/waiver-preset-rule.entity';
import { AcademicSubject } from './entities/academic-subject.entity';
import { ClassSyllabusSubject } from './entities/class-syllabus-subject.entity';
import { StudentSubjectEnrollment } from './entities/student-subject-enrollment.entity';
import { AdmissionSequence } from './entities/admission-sequence.entity';
dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'school',
  entities: [User, MenuItem, SiteSetting, Page, GoverningBodyMember, ExPrincipal, Slider, StaffMember, Teacher, Permission, UserPermission, Module, HeroSection, Notice, Fund, CostCenter, ChartOfAccount, FiscalPeriod, JournalEntry, JournalLine, VoucherSequence, FeeHead, StudentWaiver, StudentInvoice, StudentInvoiceLine, StudentCautionDeposit, PaymentCollection, Vendor, VendorBill, TaxChallan, TaxChallanItem, PayrollRun, PayslipLine, AdjunctHonorariumBill, AccountingAuditLog, AdmissionCampaign, AdmissionApplication, FamilyProfile, Student, StudentPreviousEducation, StudentEnrollment, StudentDocument, WaiverPresetRule, RequiredDocumentRule, AcademicSubject, ClassSyllabusSubject, StudentSubjectEnrollment, AdmissionSequence],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
