/** Phase 6 — payroll, MPO split & honorarium types + calculators. */

export type PayrollRunStatus = "DRAFT" | "APPROVED" | "PAID" | "REVERSED";

export interface PayslipLine {
  id: string;
  runId: string;
  employeeId: string | null;
  employeeName: string;
  designation: string | null;
  mpoGovtAmount: string;
  institutionalGrossAmount: string;
  pfEmployeeDeduction: string;
  pfEmployerContribution: string;
  aitTdsDeduction: string;
  loanDeduction: string;
  netInstitutionalPayable: string;
}

export interface PayrollRun {
  id: string;
  runNo: string;
  payrollMonth: string;
  payDate: string;
  fundId: string;
  fund?: { id: string; fundCode: string; fundName: string } | null;
  costCenterId: string | null;
  mpoGovtTotal: string;
  institutionalGrossTotal: string;
  pfEmployeeTotal: string;
  pfEmployerTotal: string;
  aitTdsTotal: string;
  loanDeductionTotal: string;
  netPayableTotal: string;
  status: PayrollRunStatus;
  glJournalId: string | null;
  glJournal?: { id: string; voucherNo: string } | null;
  paymentJournalId: string | null;
  paymentJournal?: { id: string; voucherNo: string } | null;
  narration: string | null;
  /** Present on detail + list responses; guarded as optional for safety. */
  lines?: PayslipLine[];
}

export type HonorariumStatus = "DRAFT" | "APPROVED" | "PAID" | "REVERSED";

export interface HonorariumBill {
  id: string;
  billNo: string;
  adjunctName: string;
  adjunctId: string | null;
  workMonth: string;
  classesCount: number;
  scriptsCount: number;
  vivaCount: number;
  ratePerClass: string;
  ratePerScript: string;
  ratePerViva: string;
  grossAmount: string;
  tdsRate: string;
  tdsAmount: string;
  netPayable: string;
  fundId: string;
  fund?: { id: string; fundCode: string; fundName: string } | null;
  costCenterId: string | null;
  status: HonorariumStatus;
  glJournalId: string | null;
  glJournal?: { id: string; voucherNo: string } | null;
  narration: string | null;
}

/** Round-half-up to 2dp (matches the API's decimal.js ROUND_HALF_UP). */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Client preview of a payslip net — MPO excluded by construction. */
export function calcPayslipNet(
  gross: number,
  pfEmp: number,
  ait: number,
  loan: number,
) {
  return r2(gross - pfEmp - ait - loan);
}

/** Client preview of an honorarium bill — mirrors the API exactly. */
export function calcHonorarium(
  classes: number,
  scripts: number,
  viva: number,
  rateC: number,
  rateS: number,
  rateV: number,
  tdsRate: number,
) {
  const gross = r2(classes * rateC + scripts * rateS + viva * rateV);
  const tds = r2((gross * tdsRate) / 100);
  return { gross, tds, net: r2(gross - tds) };
}
