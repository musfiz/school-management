# Educational ERP Accounting & Billing System Architecture (Bangladesh)

**Tech Stack:** NestJS (Backend) | Next.js (Frontend) | MySQL 8.x (Current) -> PostgreSQL (Future Migration)  
**Primary Key Strategy:** UUID v4 (`CHAR(36)` in MySQL / Native `UUID` in PostgreSQL)  
**Compliance Standards:** IFRS/IAS, Directorate of Inspection & Audit (DIA), UGC, NBR (TDS/VDS), and AAOIFI (Islamic Fund Accounting for Madrasas).

---

## 1. Executive Functional Requirements

Educational institutions in Bangladesh (Schools, Colleges, Universities, and Alia/Qawmi Madrasas) require **Multi-Dimensional Fund Accounting** combined with **Automated Sub-Ledger Double-Entry Posting**.

### 1.1 Core Accounting Principles

1. **Strict Fund Segregation:**
   - **Schools/Colleges:** General Fund, Reserve Fund, Development Fund, Poor Fund, and Caution Money (Liability).
   - **Madrasas:** Strict isolation between the **Lillah/Zakat Fund** (restricted strictly to orphan/poor student food, clothing, and lodging) and the **General/Sadaqah Fund** (used for salaries, utilities, and construction).
2. **Accrual Billing + Dual Basis Reporting:**
   - Student invoices are generated on an **Accrual Basis** (recognizing receivables and gross revenue immediately).
   - Reporting supports both **Cash Basis** (DIA Receipts & Payments Account) and **Accrual Basis** (Income & Expenditure Account & Balance Sheet).
3. **Gross-to-Net Waiver Accounting:**
   - Waivers (Merit, Sibling, Freedom Fighter Quota, Lillah Subsidy) must never silently reduce invoice totals. The system must record **Gross Tuition Revenue (Cr)** alongside **Contra-Revenue Waiver Expense (Dr)** and **Net Student Receivable (Dr)**.
4. **MFS & Gateway TDR Splitting:**
   - Payments via **bKash, Nagad, Rocket, Upay, SSLCommerz, or EkPay** must credit the student's ledger with the **100% gross amount paid**, while automatically splitting the settlement into **Net Bank/Clearing Debit** and **Gateway TDR Commission Expense Debit**.
5. **NBR Statutory Tax/VAT Withholding (VDS & TDS):**
   - Vendor bills and part-time faculty honorariums must automatically withhold **TDS (Tax Deducted at Source)** and **VDS (VAT Deducted at Source)**, crediting statutory payable heads for Treasury Challan remittance.
6. **Dual-Component Payroll (MPO vs. Institutional):**
   - Tracks Government MPO (EFT) portion for consolidated payslip visibility while only posting the Institutional salary, Provident Fund (PF), and Gratuity liability to the institution's General Ledger.
7. **Immutable Audit Controls:**
   - **Maker -> Checker -> Approver** state machine.
   - **No-Delete Policy:** Posted vouchers cannot be edited or deleted; corrections require a linked `REVERSAL` journal entry.

---

## 2. Standard 5-Digit Segmented Chart of Accounts (CoA)

### Account Segment Structure

`[Fund Code (2 digits)] - [Cost Center (3 digits)] - [Natural GL Code (5 digits)]`

- **Example 1:** `01-102-41101` -> General Fund (`01`) | Science/CSE Dept (`102`) | Tuition Fee Revenue (`41101`)
- **Example 2:** `02-901-53101` -> Lillah/Zakat Fund (`02`) | Orphanage Boarding (`901`) | Student Mess Food Expense (`53101`)

### Master GL Hierarchy

| Code Range        | Account Category                        | Normal Balance         | Financial Statement             |
| :---------------- | :-------------------------------------- | :--------------------- | :------------------------------ |
| **10000 – 19999** | **Assets** (Current & Non-Current)      | `DR`                   | Statement of Financial Position |
| **20000 – 29999** | **Liabilities** (Current & Long-Term)   | `CR`                   | Statement of Financial Position |
| **30000 – 39999** | **Fund Balances / Equity** (Net Assets) | `CR`                   | Statement of Financial Position |
| **40000 – 49999** | **Revenues / Incomes** (Gross & Contra) | `CR` (`DR` for Contra) | Income & Expenditure Account    |
| **50000 – 59999** | **Expenses / Expenditures**             | `DR`                   | Income & Expenditure Account    |

### Standard Natural GL Seed List

- **10000 – ASSETS**
  - `11101` Cash in Hand – Main Campus Petty Cash
  - `11102` Cash in Hand – Madrasa Lillah Collection Box (Restricted)
  - `11201` Commercial Bank – General Operating A/C
  - `11202` Commercial Bank – Statutory Reserve Fund A/C (FDR/STD)
  - `11203` Islami Bank – Lillah / Zakat Fund A/C (Restricted)
  - `11204` Provident Fund Trust Bank A/C
  - `11301` bKash Merchant Settlement Clearing A/C
  - `11302` Nagad Merchant Settlement Clearing A/C
  - `11303` SSLCommerz / EkPay Gateway Clearing A/C
  - `11401` Accounts Receivable – Students (Control A/C)
  - `11402` Grants & Stipends Receivable (Govt HSP)
  - `11403` Staff Advances & Loans Receivable
  - `11501` Dining / Mess Food Inventory
  - `11502` Stationery & Lab Consumables Stock
  - `12101` Land & Land Development
  - `12102` Academic & Administrative Buildings
  - `12103` Lab & IT Equipment
  - `12104` Furniture, Fixtures & Vehicles
  - `12201` Accumulated Depreciation (Contra-Asset - `CR`)
- **20000 – LIABILITIES**
  - `21101` Accounts Payable – Suppliers/Vendors (Control A/C)
  - `21102` Institutional Salaries & Allowances Payable
  - `21103` Adjunct Faculty Honorarium Payable
  - `21201` Advance Tuition & Session Fees Received (Unearned Revenue)
  - `21202` Unidentified Bank Deposits (Suspense A/C)
  - `21301` TDS (AIT) Payable – Staff Salaries
  - `21302` TDS Payable – Suppliers & Contractors
  - `21303` TDS Payable – Adjunct Faculty & Exam Remuneration
  - `21304` VDS (VAT Deducted at Source) Payable to Govt Treasury
  - `21401` Library & Lab Caution Money Deposit (Refundable)
  - `21402` Hostel / Hall Security Deposit (Refundable)
  - `22101` Employee Provident Fund (PF) Liability
  - `22102` Employee Gratuity Fund Provision
- **30000 – FUND BALANCES / EQUITY**
  - `31101` General Fund (Unrestricted Accumulated Surplus)
  - `31102` Statutory Reserve Fund
  - `31103` Development & Infrastructure Fund
  - `31104` Poor & Meritorious Student Welfare Fund
  - `31201` Lillah / Zakat Fund Balance (Strictly Restricted)
  - `31202` Waqf / Sadaqah Jariyah Endowment Fund
- **40000 – REVENUES & CONTRA-REVENUES**
  - `41101` Tuition Fee Revenue (Monthly / Credit-Hour)
  - `41102` Admission & Readmission Fee
  - `41103` Session / Annual Development Fee
  - `41104` Examination & Transcript Fee
  - `41105` Laboratory, Computer & Library Fee
  - `41901` Merit & CGPA Scholarship Waiver (Contra-Revenue - `DR`)
  - `41902` Freedom Fighter Quota Waiver (Contra-Revenue - `DR`)
  - `41903` Sibling, Staff-Child & Financial Aid Waiver (Contra-Revenue - `DR`)
  - `41904` Lillah / Orphan Boarding Subsidy (Contra-Revenue - `DR`)
  - `42101` Hostel Seat Rent & Boarding Fee
  - `42102` Student Transport Fee
  - `42103` Late Payment Fines & Penalties
  - `43101` Zakat Donations Received (Restricted)
  - `43102` Sadaqah, Fitra & General Donations
  - `44101` Bank Interest / Mudaraba Profit
- **50000 – EXPENSES / EXPENDITURES**
  - `51101` Faculty/Teacher Salaries & Allowances (Institutional Portion)
  - `51102` Administrative & Support Staff Salaries
  - `51103` Adjunct Faculty & Exam Script Checking Honorarium
  - `51104` Employer Provident Fund (PF) Matching Contribution
  - `52101` Question Printing, Answer Scripts & Moderation Expense
  - `52102` Lab Consumables & Internet Bandwidth
  - `52103` Board / UGC / University Affiliation & Registration Remittance
  - `53101` Orphan & Poor Student Mess Food / Groceries (Zakat Eligible)
  - `53102` Orphan Student Clothing, Medicine & Books (Zakat Eligible)
  - `54101` Campus Rent, Municipal Tax & Utilities (Electricity, Gas, WASA)
  - `54102` Repairs & Maintenance
  - `54103` Payment Gateway TDR Charges (bKash/Nagad/SSLCommerz Commission)
  - `54104` Bank Charges & Excise Duty
  - `54105` Depreciation Expense

---

## 3. Database Schema (MySQL 8.x with UUID v4 & PostgreSQL Portability)

### UUID v4 Portability Strategy (MySQL -> PostgreSQL)

- **Primary & Foreign Keys:** All `id` and `*_id` columns use `CHAR(36)` in MySQL to store standard hyphenated UUID v4 strings (`e.g., 550e8400-e29b-41d4-a716-446655440000`).
- **Generation Layer:** Generate UUID v4 values in **NestJS** using `@PrimaryGeneratedColumn('uuid')` (TypeORM) or `@default(uuid())` (Prisma), or via MySQL 8.0's `DEFAULT (UUID())`. Generating UUIDs in the NestJS application layer is strongly recommended so the exact same entity code works seamlessly when you switch the database driver from `mysql2` to `pg` (PostgreSQL).
- **Monetary Precision:** All currency amounts use `DECIMAL(15, 2)` (never `FLOAT` or `DOUBLE`).

```sql
-- =========================================================================
-- 1. CORE ACCOUNTING & MULTI-FUND ENGINE (UUID v4)
-- =========================================================================

CREATE TABLE funds (
    id CHAR(36) NOT NULL PRIMARY KEY,
    fund_code VARCHAR(10) NOT NULL UNIQUE,      -- e.g., '01' (General), '02' (Zakat/Lillah)
    fund_name VARCHAR(100) NOT NULL,
    is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
    shariah_compliant BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cost_centers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    center_code VARCHAR(15) NOT NULL UNIQUE,    -- e.g., '101' (Science), '201' (Hifz Dept)
    center_name VARCHAR(100) NOT NULL,
    institution_type VARCHAR(20) NOT NULL,
    parent_id CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_inst_type CHECK (institution_type IN ('SCHOOL', 'COLLEGE', 'UNIVERSITY', 'MADRASA')),
    CONSTRAINT fk_cost_center_parent FOREIGN KEY (parent_id) REFERENCES cost_centers(id) ON DELETE RESTRICT
);

CREATE TABLE chart_of_accounts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    gl_code VARCHAR(20) NOT NULL UNIQUE,        -- e.g., '11401', '41101'
    account_name VARCHAR(150) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    normal_balance CHAR(2) NOT NULL,
    parent_id CHAR(36) NULL,
    is_control_account BOOLEAN NOT NULL DEFAULT FALSE,
    is_cash_or_bank BOOLEAN NOT NULL DEFAULT FALSE,
    default_fund_id CHAR(36) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_acc_type CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'CONTRA_REVENUE', 'CONTRA_ASSET')),
    CONSTRAINT chk_norm_bal CHECK (normal_balance IN ('DR', 'CR')),
    CONSTRAINT fk_coa_parent FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_coa_default_fund FOREIGN KEY (default_fund_id) REFERENCES funds(id) ON DELETE RESTRICT
);

CREATE TABLE fiscal_periods (
    id CHAR(36) NOT NULL PRIMARY KEY,
    period_name VARCHAR(50) NOT NULL,           -- e.g., 'FY 2026-2027 (July-June)'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    closed_by_user_id CHAR(36) NULL,
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 2. IMMUTABLE DOUBLE-ENTRY GENERAL LEDGER (MAKER-CHECKER-APPROVER)
-- =========================================================================

CREATE TABLE journal_entries (
    id CHAR(36) NOT NULL PRIMARY KEY,
    voucher_no VARCHAR(30) NOT NULL UNIQUE,     -- e.g., 'JV-2026-000451', 'MR-2026-09812'
    voucher_type VARCHAR(20) NOT NULL,
    transaction_date DATE NOT NULL,
    fiscal_period_id CHAR(36) NOT NULL,
    source_module VARCHAR(30) NOT NULL,         -- 'STUDENT_BILLING', 'MFS_COLLECTION', 'PAYROLL', 'PROCUREMENT', 'MANUAL'
    source_reference_id CHAR(36) NULL,          -- Polymorphic UUID pointing to invoice.id, collection.id, etc.
    narration TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    reversed_entry_id CHAR(36) NULL,
    created_by_user_id CHAR(36) NOT NULL,       -- Maker UUID
    verified_by_user_id CHAR(36) NULL,          -- Checker UUID
    approved_by_user_id CHAR(36) NULL,          -- Approver
```
