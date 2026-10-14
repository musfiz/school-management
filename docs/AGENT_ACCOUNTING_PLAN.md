# MASTER AGENT IMPLEMENTATION PLAN: Bangladesh Educational Accounting & Billing ERP Module

## 1. System Context & Tech Stack Rules (STRICT CONSTRAINTS)

You are implementing an enterprise-grade, double-entry **Fund Accounting & Student Billing System** tailored for Bangladeshi Schools, Colleges, Universities, and Madrasas (compliant with DIA, UGC, NBR VDS/TDS, and AAOIFI Zakat/Lillah standards).

### Tech Stack

- **Backend:** NestJS (TypeScript, modular architecture, Dependency Injection, Class-Validator, Class-Transformer).
- **ORM / Database:** Prisma ORM or TypeORM configured for **MySQL 8.x** today, written with **100% PostgreSQL portability** for future migration.
- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table v8, React Hook Form + Zod, TanStack Query).
- **Queue / Cron:** `@nestjs/schedule` or BullMQ (for monthly recurring fee generation, late fine calculation, and advance fee amortization).

### Database Portability Rules (MySQL -> PostgreSQL Ready)

1. **Monetary Types:** ALWAYS use `DECIMAL(15, 2)` (never `FLOAT` or `DOUBLE`). In TypeScript, use `decimal.js` for all arithmetic before saving to DB.
2. **Identifiers:** Use `BIGINT` auto-increment or `UUID` (`CHAR(36)`) consistently across foreign keys.
3. **Enums & Booleans:** Use `VARCHAR(30)` backed by TypeScript Enums (avoids MySQL vs. Postgres native ENUM migration pain) and `BOOLEAN` (`TINYINT(1)` in MySQL via ORM boolean mapping).
4. **Transactions:** Every accounting operation MUST execute inside an interactive database transaction (`SERIALIZABLE` or `REPEATABLE READ` isolation level) with pessimistic row locking (`FOR UPDATE`) when checking balances or generating sequential voucher numbers.
5. **No Raw Dialect SQL:** Avoid MySQL-specific functions (`IFNULL`, `GROUP_CONCAT`, backtick quotes) in repositories; use standard ANSI SQL or ORM query builders.

---

## 2. Target Directory Structure

### Backend (`apps/api/src/modules/accounting/`)

```text
src/modules/accounting/
├── core-gl/                  # Funds, Cost Centers, CoA, Fiscal Periods, Journal Engine
├── student-billing/          # Fee Heads, Structures, Waivers, Invoicing, Late Fines, Caution Deposits
├── collections-mfs/          # Cash/Bank Challan, bKash/Nagad/SSLCommerz Webhooks, TDR Split, Reconciliation
├── procurement-tax/          # Vendor Bills, NBR VDS/TDS Withholding, Mushak 6.3, Treasury Challan
├── payroll-mpo/              # MPO vs Institutional Split, Adjunct Faculty Honorarium, Salary AIT, PF Trust
├── fixed-assets-inventory/   # FAR, Depreciation Runner, Madrasa/Hostel Mess Inventory
├── reports-audit/            # DIA Receipts & Payments, Income & Expenditure, Balance Sheet, Aging
└── common/                   # Decimal helpers, Voucher sequence generator, Fund-balance guard
```

### Frontend (`apps/web/src/app/(dashboard)/accounting/`)

```text
src/app/(dashboard)/accounting/
├── chart-of-accounts/        # Tree view CoA, Fund & Cost Center setup
├── vouchers/                 # Journal, Payment, Receipt, Contra entry forms + Maker/Checker queue
├── billing/                  # Fee setup, Waiver assignment, Bulk Invoice generator, Student Ledger
├── collection/               # POS Fee Collection screen, Bank Challan scanner, MFS Settlement viewer
├── payables-tax/             # Vendor bill entry, VDS/TDS calculator, NBR Treasury Challan register
├── payroll/                  # Monthly salary sheet (MPO/Inst split), Teacher Honorarium, PF ledger
└── reports/                  # Trial Balance, DIA Receipts & Payments, Income/Expenditure, Defaulter Aging
```

---

## 3. Step-by-Step Execution Phases (First to Last)

Execute the implementation sequentially across **8 Phases**. Do not proceed to the next phase until all validation gates and unit/integration tests for the current phase pass.

---

### PHASE 1: Database Schema, ORM Models & Seed Data

**Objective:** Establish the relational tables and seed the Bangladesh-standard 5-digit Chart of Accounts and Funds.

#### Tasks:

1. **Create Database Entities / Prisma Models:**
   - `Fund`: `id`, `fund_code` (`01` General, `02` Lillah/Zakat, `03` Reserve, `04` Poor Fund), `fund_name`, `is_restricted`, `shariah_compliant`.
   - `CostCenter`: `id`, `center_code`, `center_name`, `institution_type` (`SCHOOL`, `COLLEGE`, `UNIVERSITY`, `MADRASA`), `parent_id`.
   - `ChartOfAccount`: `id`, `gl_code` (5-digit unique), `account_name`, `account_type` (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`, `CONTRA_REVENUE`, `CONTRA_ASSET`), `normal_balance` (`DR`, `CR`), `parent_id`, `is_control_account`, `is_cash_or_bank`, `default_fund_id`, `is_active`.
   - `FiscalPeriod`: `id`, `period_name` (e.g., `FY 2026-2027`), `start_date` (`2026-07-01`), `end_date` (`2027-06-30`), `is_closed`.
   - `JournalEntry`: `id`, `voucher_no` (unique), `voucher_type` (`JOURNAL`, `RECEIVE`, `PAYMENT`, `CONTRA`, `REVERSAL`), `transaction_date`, `fiscal_period_id`, `source_module`, `source_reference_id`, `narration`, `status` (`DRAFT`, `VERIFIED`, `APPROVED`, `REVERSED`), `reversed_entry_id`, `created_by`, `verified_by`, `approved_by`, `approved_at`.
   - `JournalLine`: `id`, `journal_entry_id`, `gl_account_id`, `fund_id`, `cost_center_id`, `subledger_type` (`STUDENT`, `VENDOR`, `EMPLOYEE`, `DONOR`), `subledger_id`, `debit_amount`, `credit_amount`, `line_memo`.
2. **Write Migration & Seeder (`seed-accounting.ts`):**
   - Seed the 4 core Funds (`01` General, `02` Lillah/Zakat Restricted, `03` Reserve, `04` Welfare).
   - Seed the complete 5-digit CoA hierarchy (`10000` Assets through `59999` Expenses, including `11301` bKash Clearing, `11401` Student AR, `21302` TDS Payable, `21304` VDS Payable, `41101` Tuition Revenue, `41901` Merit Waiver Contra-Revenue, `54103` Gateway TDR Expense).

#### Phase 1 Acceptance Criteria:

- [ ] Migrations run cleanly on MySQL without dialect-specific syntax errors.
- [ ] Seeder populates all Funds and the 5-digit Chart of Accounts hierarchy idempotently.

---

### PHASE 2: Core Double-Entry & Fund Accounting Engine (NestJS)

**Objective:** Build the immutable General Ledger posting service with strict double-entry and fund-isolation enforcement.

#### Tasks:

1. **Build `VoucherSequenceService`:**
   - Generate collision-free sequential numbers per fiscal year and type (e.g., `JV-2026-000001`, `MR-2026-000001`, `PV-2026-000001`).
2. **Build `JournalPostingService`:**
   - Implement `createJournalEntry(dto, entityManager)` and `approveJournalEntry(id, approverId)`.
   - **Validation Rule 1 (Zero-Sum Balance):** Reject if $\sum \text{Dr} \neq \sum \text{Cr}$ or $\sum \text{Dr} \le 0$.
   - **Validation Rule 2 (Line Exclusivity):** Reject if any line has both `debit_amount > 0` and `credit_amount > 0`, or negative numbers.
   - **Validation Rule 3 (Strict Fund Isolation):** Group lines by `fund_id`. For every `fund_id` in the voucher, verify $\sum \text{Dr}_{\text{fund}} = \sum \text{Cr}_{\text{fund}}$. (Prevents paying General Fund expenses from the Madrasa Lillah/Zakat Bank Account).
   - **Validation Rule 4 (Control Account Subledger Enforcement):** If `ChartOfAccount.is_control_account === true` (e.g., `11401` Student AR, `21101` Vendor AP), require non-null `subledger_type` and `subledger_id`.
   - **Validation Rule 5 (Period Lock):** Reject if `transaction_date` falls in a `FiscalPeriod` where `is_closed === true`.
3. **Implement Immutable Reversal Engine (`reverseJournalEntry`):**
   - Block `DELETE` and `UPDATE` on `APPROVED` journal entries via NestJS guard/interceptor.
   - Create a mirror `REVERSAL` entry swapping Debits and Credits, linking `reversed_entry_id`, and marking the original status as `REVERSED`.

#### Phase 2 Acceptance Criteria:

- [ ] Unit tests verify that unbalanced entries, cross-fund leaks (Zakat to General), closed-period dates, and control-account lines missing a `subledger_id` throw `BadRequestException`.
- [ ] Reversing an approved entry creates an exact offsetting entry atomically.

---

### PHASE 3: Student Billing, Waivers, Stipends & Liability Engine

**Objective:** Automate fee invoicing for Schools/Colleges (monthly/term), Universities (credit-hour), and Madrasas (Lillah boarding subsidy) with automatic accrual journal generation.

#### Tasks:

1. **Create Billing Entities:**
   - `FeeHead`, `StudentWaiverScholarship`, `StudentInvoice`, `StudentInvoiceLine`, `StudentCautionDeposit`.
2. **Build `StudentBillingService`:**
   - **Formula:** For each fee head, calculate `gross_amount` (either fixed or `credit_hours * per_credit_rate`), apply active `StudentWaiverScholarship` to compute `waiver_amount`, and set `net_amount = gross_amount - waiver_amount`.
   - **Auto-Post Accrual Journal on Invoice Generation:**
     - `Dr` `11401` Accounts Receivable – Student (`subledger_id = student_id`) = `net_payable_amount`
     - `Dr` `41901..41904` Waiver/Scholarship Contra-Revenue = `total_waiver_amount`
     - `Cr` `41101..41106` Relevant Fee Revenue (or `21401` Caution Deposit Liability) = `total_gross_amount`
   - **Madrasa Lillah Subsidy Rule:** If a student has a `100% LILLAH_ZAKAT_ORPHAN` boarding waiver, post the boarding fee expense/waiver against `Fund 02 (Lillah/Zakat Fund)`.
3. **Build Advance Fee & Caution Deposit Handlers:**
   - If a student pays for future unbilled months, credit `21201 Advance Tuition Fee (Liability)`. Build a monthly cron job on the 1st of each month to amortize `21201` (Dr) into `41101 Tuition Revenue` (Cr).
   - Provide an endpoint to settle or refund `21401..21403 Caution Money Deposit` upon graduation (deducting damage fines if any).
4. **Build Late Fine Automation Cron:**
   - Scheduled job checks overdue `UNPAID` / `PARTIAL` invoices past `due_date`, calculates configurable late fines, updates `StudentInvoice.late_fine_amount`, and posts `Dr 11401 Student AR / Cr 42103 Late Payment Fine Revenue`.

#### Phase 3 Acceptance Criteria:

- [ ] Generating a 10,000 BDT invoice with a 20% merit waiver creates an invoice of 8,000 BDT net and posts an approved 3-line balanced Journal Entry (Dr AR 8,000, Dr Waiver 2,000, Cr Tuition 10,000).
- [ ] Duplicate invoice generation for the same student and billing period is prevented by a unique composite constraint.

---

### PHASE 4: Payment Collection, MFS Gateways (bKash/Nagad/SSLCommerz) & TDR Split

**Objective:** Handle counter cash, barcoded bank challans, and online MFS payments with automatic Transaction Discount Rate (TDR) fee splitting and reconciliation.

#### Tasks:

1. **Create Collection Entities:**
   - `PaymentCollection`: `money_receipt_no`, `student_id`, `invoice_id`, `payment_channel`, `gateway_trx_id` (unique), `collected_gross_amount`, `gateway_tdr_fee`, `net_bank_amount`, `reconciliation_status`, `gl_journal_id`.
2. **Build `FeeCollectionService` (Counter Cash & Bank Challan):**
   - Accept full or partial payment against `StudentInvoice`.
   - Allocate payment across invoice lines by priority (Arrears -> Late Fine -> Tuition -> Other Fees).
   - Update `StudentInvoice.paid_amount` and status (`PARTIAL` or `PAID`).
3. **Build `MfsWebhookService` (bKash, Nagad, SSLCommerz, EkPay):**
   - Verify cryptographic signature/token from gateway callback and enforce idempotency on `gateway_trx_id`.
   - **TDR Accounting Split:** When a student pays `5,000 BDT` and gateway TDR is `1.0% (50 BDT)`:
     - `Dr` `11301` bKash Merchant Settlement Clearing A/C = `4,950.00`
     - `Dr` `54103` Payment Gateway TDR Expense = `50.00`
     - `Cr` `11401` Accounts Receivable – Student (`subledger_id = student_id`) = `5,000.00`
4. **Build Settlement & Bank Scroll Reconciliation Service:**
   - When the gateway transfers funds from the Clearing Account (`11301`) to the Mother Commercial Bank (`11201`), post a `CONTRA` voucher: `Dr 11201 Commercial Bank / Cr 11301 bKash Clearing` and mark `reconciliation_status = 'SETTLED'`.

#### Phase 4 Acceptance Criteria:

- [ ] Replaying the same bKash webhook payload twice processes the payment only once (idempotent).
- [ ] Student ledger reflects the full gross payment (`5,000 BDT`) while bank clearing reflects net settled amount (`4,950 BDT`) and TDR expense records `50 BDT`.

---

### PHASE 5: Procurement, Vendor Payables & NBR Tax/VAT (VDS & TDS) Engine

**Objective:** Manage supplier bills, fixed asset purchases, and mandatory Bangladesh National Board of Revenue (NBR) source deductions.

#### Tasks:

1. **Create Procurement & Tax Entities:**
   - `Vendor`, `VendorBill`, `TaxChallanRemittance`.
2. **Build `VendorBillService` with NBR VDS/TDS Engine:**
   - Input: `gross_bill_amount`, `tds_rate`, `vds_rate`, `mushak_6_3_received` (boolean), `expense_or_asset_gl_id`, `fund_id`, `cost_center_id`.
   - Calculate:
     - `tds_deducted_amount = round(gross_bill_amount * (tds_rate / 100), 2)`
     - `vds_deducted_amount = round(gross_bill_amount * (vds_rate / 100), 2)`
     - `net_payable_to_vendor = gross_bill_amount - tds_deducted_amount - vds_deducted_amount`
   - **Auto-Post Bill Approval Journal:**
     - `Dr` `5xxxx` Expense or `121xx` Asset GL = `gross_bill_amount`
     - `Cr` `21101` Accounts Payable – Vendor (`subledger_id = vendor_id`) = `net_payable_to_vendor`
     - `Cr` `21302` TDS Payable – Suppliers = `tds_deducted_amount`
     - `Cr` `21304` VDS Payable to Govt Treasury = `vds_deducted_amount`
3. **Build Treasury Challan Remittance Endpoint:**
   - Allow accountant to select unpaid TDS/VDS deductions, input Bangladesh Bank/Sonali Bank `treasury_challan_no` and date, and auto-post:
     - `Dr` `21302` / `21304` TDS/VDS Payable
     - `Cr` `11201` Commercial Bank Operating A/C

#### Phase 5 Acceptance Criteria:

- [ ] A 100,000 BDT printing bill with 10% TDS and 7.5% VDS automatically credits Vendor AP with 82,500 BDT, TDS Payable with 10,000 BDT, and VDS Payable with 7,500 BDT.

---

### PHASE 6: Payroll, MPO Split, Adjunct Honorarium & Provident Fund

**Objective:** Handle Bangladeshi teacher/staff payroll, separating Government MPO EFT portions from Institutional salary expenses.

#### Tasks:

1. **Create Payroll Entities:**
   - `PayrollRun`, `PayslipLine` (`mpo_govt_amount`, `institutional_gross_amount`, `pf_employee_deduction`, `pf_employer_contribution`, `ait_tds_deduction`, `loan_deduction`, `net_institutional_payable`), `AdjunctHonorariumBill`.
2. **Build `PayrollAccountingService`:**
   - **MPO Isolation Rule:** Record `mpo_govt_amount` on the payslip for informational/tax reporting, but ONLY post `institutional_gross_amount` and `pf_employer_contribution` to the institution's General Ledger:
     - `Dr` `51101` Basic Salary & Allowances (Institutional) = `institutional_gross_amount`
     - `Dr` `51104` Employer PF Matching Contribution = `pf_employer_contribution`
     - `Cr` `22101` Employee Provident Fund Liability = `pf_employee_deduction + pf_employer_contribution`
     - `Cr` `21301` TDS (AIT) Payable – Staff Salaries = `ait_tds_deduction`
     - `Cr` `11403` Staff Advances & Loans Receivable (`subledger_id = employee_id`) = `loan_deduction`
     - `Cr` `21102` Salaries Payable = `net_institutional_payable`
3. **Build University Adjunct / Guest Faculty Honorarium Service:**
   - Calculate pay from classes/scripts/viva counts, deduct mandatory 10%–15% TDS (`21303`), and credit `21103 Adjunct Faculty Honorarium Payable`.

#### Phase 6 Acceptance Criteria:

- [ ] Payroll journal entries exclude MPO government direct transfers from institutional cash/bank liability while displaying them on employee payslips.

---

### PHASE 7: Statutory & Audit Reporting Engine (DIA, UGC, Board & Madrasa)

**Objective:** Generate real-time financial statements required by Bangladeshi auditors.

#### Tasks:

1. **Build `FinancialReportsService`:**
   - **Trial Balance:** Group approved `JournalLine` records by `gl_account_id`, `fund_id`, and `cost_center_id` with opening balance, period debit, period credit, and closing balance.
   - **DIA Receipts & Payments Account (Cash Basis Extractor):**
     - Query all `APPROVED` journal entries where at least one line touches an account with `is_cash_or_bank = true`.
     - Calculate Opening Cash/Bank/MFS Balances + Itemized Counterpart Receipts = Itemized Counterpart Payments + Closing Cash/Bank/MFS Balances.
   - **Statement of Income & Expenditure (Accrual Basis):**
     - Aggregate all `REVENUE` (`40000`), `CONTRA_REVENUE` (`41900`), and `EXPENSE` (`50000`) accounts filterable by `fund_id` and `cost_center_id` with Budget vs. Actual variance columns.
   - **Statement of Financial Position (Balance Sheet):**
     - Aggregate `ASSET`, `CONTRA_ASSET`, `LIABILITY`, and `EQUITY/FUND_BALANCE` + Current Period Net Surplus/Deficit per Fund.
   - **Student Defaulter & Aging Report:**
     - Bucket unpaid `StudentInvoice` balances into `0–30 days`, `31–60 days`, `61–90 days`, and `90+ days` overdue by Class/Department/Batch.

#### Phase 7 Acceptance Criteria:

- [ ] Trial Balance Debits equal Credits across all filters.
- [ ] Receipts & Payments Account reconciles exact Opening Cash/Bank + Total Receipts - Total Payments = Closing Cash/Bank.

---

### PHASE 8: Next.js Frontend Dashboard & Workflows

**Objective:** Build fast, keyboard-friendly accounting interfaces for cashiers, accountants, and principals.

#### Tasks:

1. **Chart of Accounts & Fund Manager (`/accounting/chart-of-accounts`):**
   - Collapsible hierarchical tree view showing 5-digit code, account type badge, fund tag, and running balance.
2. **Double-Entry Voucher Workbench (`/accounting/vouchers`):**
   - Dynamic multi-row form (`useFieldArray`) with keyboard shortcuts, real-time Total Debit / Total Credit / Difference bar, Fund Balance indicator, and Maker -> Checker -> Approver status action buttons.
   - Block submission button until `Total Debit === Total Credit` and `Per-Fund Difference === 0`.
3. **POS Student Fee Collection Screen (`/accounting/collection`):**
   - Instant search by Student ID / Roll / Phone / Barcode Challan.
   - Displays unpaid invoices, waivers, late fines, partial payment input, payment method selector, and instant printable Money Receipt (3-part thermal or A4).
4. **Vendor Bill & NBR Tax Desk (`/accounting/payables-tax`):**
   - Interactive calculator showing Gross Bill -> Auto TDS/VDS deduction -> Net Payable, plus a "Pending NBR Treasury Challan" tab to batch-pay withheld taxes.
5. **Audit & Statutory Report Viewer (`/accounting/reports`):**
   - Date-range, Fund (`General` vs `Lillah/Zakat`), and Cost Center filters with one-click export to **PDF (with signature blocks for Accountant, Principal, and Auditor)** and **Excel/CSV**.

#### Phase 8 Acceptance Criteria:

- [ ] Voucher workbench prevents submitting unbalanced or cross-fund vouchers on the client side before API call.
- [ ] POS Collection screen generates a printable receipt with sequential `MR-YYYY-XXXXXX` number in under 1 second.

---

## 4. Final Verification & Audit Checklist (Agent Self-Test)

Before marking the implementation complete, run an automated end-to-end (E2E) test suite (`accounting.e2e-spec.ts`) covering this full lifecycle:

1. Seed CoA and Funds (`01` General, `02` Lillah/Zakat).
2. Create a Student, assign a 25% Merit Waiver, and generate a `10,000 BDT` Tuition Invoice -> Verify `Student AR = 7,500`, `Merit Waiver = 2,500`, `Tuition Revenue = 10,000`.
3. Simulate a bKash Webhook payment of `7,500 BDT` with `75 BDT` TDR fee -> Verify Invoice becomes `PAID`, `Student AR` balance becomes `0.00`, `bKash Clearing = 7,425`, and `Gateway TDR Expense = 75`.
4. Attempt to pay a General Fund electricity bill (`54101`) using the Madrasa Zakat Bank Account (`11203`) -> Verify the engine throws a `CrossFundIsolationError`.
5. Post a `50,000 BDT` Vendor Bill with `10% TDS` and `7.5% VDS` -> Verify `Vendor AP = 41,250`, `TDS Payable = 5,000`, `VDS Payable = 3,750`.
6. Generate the Trial Balance, DIA Receipts & Payments Account, Income & Expenditure Account, and Balance Sheet -> Verify `Total Assets == Total Liabilities + Fund Balances` to the exact decimal (`0.00` discrepancy).
