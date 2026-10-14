import { DataSource } from 'typeorm';
import { config } from '../config';
import { Fund } from './entities/fund.entity';
import { CostCenter } from './entities/cost-center.entity';
import {
  ChartOfAccount,
  NORMAL_BALANCE_BY_TYPE,
  type AccountType,
} from './entities/chart-of-account.entity';
import { FiscalPeriod } from './entities/fiscal-period.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host: config().database.host,
  port: config().database.port,
  username: config().database.username,
  password: config().database.password,
  database: config().database.database,
  entities: [Fund, CostCenter, ChartOfAccount, FiscalPeriod],
  synchronize: true,
  logging: false,
});

interface FundSeed {
  code: string;
  name: string;
  restricted?: boolean;
  shariah?: boolean;
}

const FUNDS: FundSeed[] = [
  { code: '01', name: 'General Fund' },
  { code: '02', name: 'Lillah / Zakat Fund', restricted: true, shariah: true },
  { code: '03', name: 'Statutory Reserve Fund' },
  { code: '04', name: 'Development & Infrastructure Fund' },
  { code: '05', name: 'Poor & Welfare Fund' },
];

interface CenterSeed {
  code: string;
  name: string;
  type: 'SCHOOL' | 'COLLEGE' | 'UNIVERSITY' | 'MADRASA';
}

const CENTERS: CenterSeed[] = [
  { code: '101', name: 'General Administration', type: 'SCHOOL' },
  { code: '102', name: 'Science / CSE Dept', type: 'COLLEGE' },
  { code: '201', name: 'Hifz Department', type: 'MADRASA' },
  { code: '901', name: 'Orphanage Boarding', type: 'MADRASA' },
];

interface AccountSeed {
  code: string;
  name: string;
  type: AccountType;
  parent?: string;
  control?: boolean;
  cash?: boolean;
  fund?: string;
}

/** Category headers first (parents), then leaves — mirrors spec §2 seed list. */
const ACCOUNTS: AccountSeed[] = [
  { code: '10000', name: 'ASSETS', type: 'ASSET' },
  { code: '20000', name: 'LIABILITIES', type: 'LIABILITY' },
  { code: '30000', name: 'FUND BALANCES / EQUITY', type: 'EQUITY' },
  { code: '40000', name: 'REVENUES & INCOMES', type: 'REVENUE' },
  { code: '50000', name: 'EXPENSES / EXPENDITURES', type: 'EXPENSE' },

  { code: '11101', name: 'Cash in Hand – Main Campus Petty Cash', type: 'ASSET', parent: '10000', cash: true },
  { code: '11102', name: 'Cash in Hand – Madrasa Lillah Collection Box (Restricted)', type: 'ASSET', parent: '10000', cash: true, fund: '02' },
  { code: '11201', name: 'Commercial Bank – General Operating A/C', type: 'ASSET', parent: '10000', cash: true, fund: '01' },
  { code: '11202', name: 'Commercial Bank – Statutory Reserve Fund A/C (FDR/STD)', type: 'ASSET', parent: '10000', cash: true, fund: '03' },
  { code: '11203', name: 'Islami Bank – Lillah / Zakat Fund A/C (Restricted)', type: 'ASSET', parent: '10000', cash: true, fund: '02' },
  { code: '11204', name: 'Provident Fund Trust Bank A/C', type: 'ASSET', parent: '10000', cash: true },
  { code: '11301', name: 'bKash Merchant Settlement Clearing A/C', type: 'ASSET', parent: '10000', cash: true },
  { code: '11302', name: 'Nagad Merchant Settlement Clearing A/C', type: 'ASSET', parent: '10000', cash: true },
  { code: '11303', name: 'SSLCommerz / EkPay Gateway Clearing A/C', type: 'ASSET', parent: '10000', cash: true },
  { code: '11401', name: 'Accounts Receivable – Students (Control A/C)', type: 'ASSET', parent: '10000', control: true },
  { code: '11402', name: 'Grants & Stipends Receivable (Govt HSP)', type: 'ASSET', parent: '10000', control: true },
  { code: '11403', name: 'Staff Advances & Loans Receivable', type: 'ASSET', parent: '10000', control: true },
  { code: '11501', name: 'Dining / Mess Food Inventory', type: 'ASSET', parent: '10000' },
  { code: '11502', name: 'Stationery & Lab Consumables Stock', type: 'ASSET', parent: '10000' },
  { code: '12101', name: 'Land & Land Development', type: 'ASSET', parent: '10000' },
  { code: '12102', name: 'Academic & Administrative Buildings', type: 'ASSET', parent: '10000' },
  { code: '12103', name: 'Lab & IT Equipment', type: 'ASSET', parent: '10000' },
  { code: '12104', name: 'Furniture, Fixtures & Vehicles', type: 'ASSET', parent: '10000' },
  { code: '12201', name: 'Accumulated Depreciation (Contra-Asset)', type: 'CONTRA_ASSET', parent: '10000' },

  { code: '21101', name: 'Accounts Payable – Suppliers/Vendors (Control A/C)', type: 'LIABILITY', parent: '20000', control: true },
  { code: '21102', name: 'Institutional Salaries & Allowances Payable', type: 'LIABILITY', parent: '20000', control: true },
  { code: '21103', name: 'Adjunct Faculty Honorarium Payable', type: 'LIABILITY', parent: '20000', control: true },
  { code: '21201', name: 'Advance Tuition & Session Fees Received (Unearned Revenue)', type: 'LIABILITY', parent: '20000', control: true },
  { code: '21202', name: 'Unidentified Bank Deposits (Suspense A/C)', type: 'LIABILITY', parent: '20000' },
  { code: '21301', name: 'TDS (AIT) Payable – Staff Salaries', type: 'LIABILITY', parent: '20000' },
  { code: '21302', name: 'TDS Payable – Suppliers & Contractors', type: 'LIABILITY', parent: '20000' },
  { code: '21303', name: 'TDS Payable – Adjunct Faculty & Exam Remuneration', type: 'LIABILITY', parent: '20000' },
  { code: '21304', name: 'VDS (VAT Deducted at Source) Payable to Govt Treasury', type: 'LIABILITY', parent: '20000' },
  { code: '21401', name: 'Library & Lab Caution Money Deposit (Refundable)', type: 'LIABILITY', parent: '20000', control: true },
  { code: '21402', name: 'Hostel / Hall Security Deposit (Refundable)', type: 'LIABILITY', parent: '20000', control: true },
  { code: '22101', name: 'Employee Provident Fund (PF) Liability', type: 'LIABILITY', parent: '20000' },
  { code: '22102', name: 'Employee Gratuity Fund Provision', type: 'LIABILITY', parent: '20000' },

  { code: '31101', name: 'General Fund (Unrestricted Accumulated Surplus)', type: 'EQUITY', parent: '30000' },
  { code: '31102', name: 'Statutory Reserve Fund', type: 'EQUITY', parent: '30000' },
  { code: '31103', name: 'Development & Infrastructure Fund', type: 'EQUITY', parent: '30000' },
  { code: '31104', name: 'Poor & Meritorious Student Welfare Fund', type: 'EQUITY', parent: '30000' },
  { code: '31201', name: 'Lillah / Zakat Fund Balance (Strictly Restricted)', type: 'EQUITY', parent: '30000' },
  { code: '31202', name: 'Waqf / Sadaqah Jariyah Endowment Fund', type: 'EQUITY', parent: '30000' },

  { code: '41101', name: 'Tuition Fee Revenue (Monthly / Credit-Hour)', type: 'REVENUE', parent: '40000' },
  { code: '41102', name: 'Admission & Readmission Fee', type: 'REVENUE', parent: '40000' },
  { code: '41103', name: 'Session / Annual Development Fee', type: 'REVENUE', parent: '40000' },
  { code: '41104', name: 'Examination & Transcript Fee', type: 'REVENUE', parent: '40000' },
  { code: '41105', name: 'Laboratory, Computer & Library Fee', type: 'REVENUE', parent: '40000' },
  { code: '41901', name: 'Merit & CGPA Scholarship Waiver (Contra-Revenue)', type: 'CONTRA_REVENUE', parent: '40000' },
  { code: '41902', name: 'Freedom Fighter Quota Waiver (Contra-Revenue)', type: 'CONTRA_REVENUE', parent: '40000' },
  { code: '41903', name: 'Sibling, Staff-Child & Financial Aid Waiver (Contra-Revenue)', type: 'CONTRA_REVENUE', parent: '40000' },
  { code: '41904', name: 'Lillah / Orphan Boarding Subsidy (Contra-Revenue)', type: 'CONTRA_REVENUE', parent: '40000', fund: '02' },
  { code: '42101', name: 'Hostel Seat Rent & Boarding Fee', type: 'REVENUE', parent: '40000' },
  { code: '42102', name: 'Student Transport Fee', type: 'REVENUE', parent: '40000' },
  { code: '42103', name: 'Late Payment Fines & Penalties', type: 'REVENUE', parent: '40000' },
  { code: '43101', name: 'Zakat Donations Received (Restricted)', type: 'REVENUE', parent: '40000', fund: '02' },
  { code: '43102', name: 'Sadaqah, Fitra & General Donations', type: 'REVENUE', parent: '40000' },
  { code: '44101', name: 'Bank Interest / Mudaraba Profit', type: 'REVENUE', parent: '40000' },

  { code: '51101', name: 'Faculty/Teacher Salaries & Allowances (Institutional Portion)', type: 'EXPENSE', parent: '50000' },
  { code: '51102', name: 'Administrative & Support Staff Salaries', type: 'EXPENSE', parent: '50000' },
  { code: '51103', name: 'Adjunct Faculty & Exam Script Checking Honorarium', type: 'EXPENSE', parent: '50000' },
  { code: '51104', name: 'Employer Provident Fund (PF) Matching Contribution', type: 'EXPENSE', parent: '50000' },
  { code: '52101', name: 'Question Printing, Answer Scripts & Moderation Expense', type: 'EXPENSE', parent: '50000' },
  { code: '52102', name: 'Lab Consumables & Internet Bandwidth', type: 'EXPENSE', parent: '50000' },
  { code: '52103', name: 'Board / UGC / University Affiliation & Registration Remittance', type: 'EXPENSE', parent: '50000' },
  { code: '53101', name: 'Orphan & Poor Student Mess Food / Groceries (Zakat Eligible)', type: 'EXPENSE', parent: '50000', fund: '02' },
  { code: '53102', name: 'Orphan Student Clothing, Medicine & Books (Zakat Eligible)', type: 'EXPENSE', parent: '50000', fund: '02' },
  { code: '54101', name: 'Campus Rent, Municipal Tax & Utilities', type: 'EXPENSE', parent: '50000' },
  { code: '54102', name: 'Repairs & Maintenance', type: 'EXPENSE', parent: '50000' },
  { code: '54103', name: 'Payment Gateway TDR Charges (bKash/Nagad/SSLCommerz Commission)', type: 'EXPENSE', parent: '50000' },
  { code: '54104', name: 'Bank Charges & Excise Duty', type: 'EXPENSE', parent: '50000' },
  { code: '54105', name: 'Depreciation Expense', type: 'EXPENSE', parent: '50000' },
];

async function seed() {
  console.log('🌱 Starting accounting seed...\n');
  await dataSource.initialize();
  console.log('✅ Database connected\n');

  const fundRepo = dataSource.getRepository(Fund);
  for (const f of FUNDS) {
    const existing = await fundRepo.findOne({ where: { fundCode: f.code } });
    if (!existing) {
      await fundRepo.save(
        fundRepo.create({
          fundCode: f.code,
          fundName: f.name,
          isRestricted: f.restricted ?? false,
          shariahCompliant: f.shariah ?? false,
          isActive: true,
        }),
      );
      console.log(`  + fund ${f.code} ${f.name}`);
    }
  }

  const centerRepo = dataSource.getRepository(CostCenter);
  for (const c of CENTERS) {
    const existing = await centerRepo.findOne({ where: { centerCode: c.code } });
    if (!existing) {
      await centerRepo.save(
        centerRepo.create({
          centerCode: c.code,
          centerName: c.name,
          institutionType: c.type,
          isActive: true,
        }),
      );
      console.log(`  + cost center ${c.code} ${c.name}`);
    }
  }

  const accountRepo = dataSource.getRepository(ChartOfAccount);
  for (const a of ACCOUNTS) {
    const existing = await accountRepo.findOne({ where: { glCode: a.code } });
    if (existing) continue;
    let parentId: number | null = null;
    if (a.parent) {
      const parent = await accountRepo.findOne({ where: { glCode: a.parent } });
      parentId = parent?.id ?? null;
    }
    let defaultFundId: number | null = null;
    if (a.fund) {
      const fund = await fundRepo.findOne({ where: { fundCode: a.fund } });
      defaultFundId = fund?.id ?? null;
    }
    await accountRepo.save(
      accountRepo.create({
        glCode: a.code,
        accountName: a.name,
        accountType: a.type,
        normalBalance: NORMAL_BALANCE_BY_TYPE[a.type],
        parentId,
        isControlAccount: a.control ?? false,
        isCashOrBank: a.cash ?? false,
        defaultFundId,
        isActive: true,
      }),
    );
    console.log(`  + GL ${a.code} ${a.name}`);
  }

  const periodRepo = dataSource.getRepository(FiscalPeriod);
  const periodName = 'FY 2026-2027 (July-June)';
  const existingPeriod = await periodRepo.findOne({ where: { periodName } });
  if (!existingPeriod) {
    await periodRepo.save(
      periodRepo.create({
        periodName,
        startDate: '2026-07-01',
        endDate: '2027-06-30',
        isClosed: false,
      }),
    );
    console.log(`  + fiscal period ${periodName}`);
  }

  console.log('\n✅ Accounting seed complete');
  await dataSource.destroy();
}

seed().catch(async (err) => {
  console.error('❌ Accounting seed failed:', err);
  try {
    await dataSource.destroy();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
