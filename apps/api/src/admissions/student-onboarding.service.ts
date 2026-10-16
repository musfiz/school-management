import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma as PrismaTypes } from '../generated/prisma/client';
import { PAYMENT_CHANNELS } from '../database/entities/payment-collection.entity';
import { StudentBillingService } from '../accounting/student-billing.service';
import { FeeCollectionService } from '../accounting/fee-collection.service';
import { WaiverCalculatorService, WaiverSuggestion } from './waiver-calculator.service';
import { SubjectEnrollmentService } from './subject-enrollment.service';
import { StudentIdGeneratorService } from './common/student-id-generator.service';
import { RollNumberGeneratorService } from './common/roll-number-generator.service';
import { isValidBrn, isValidNid } from './common/validators';
import type { ConfirmAdmissionDto, FeePreviewDto } from './admissions.dto';

export interface FeeSuggestItem {
  feeHeadId: string;
  headCode: string;
  headName: string;
  billingType: string;
  grossAmount: string;
  isCautionDeposit: boolean;
}

/**
 * Workflow 4 — Atomic Admission Invoice & Accounting GL Posting
 * (Admission Plan §4 Workflow 4, Phase 3).
 *
 * admit() runs SIX steps in ONE REPEATABLE READ transaction:
 * family upsert → student + prev-education → enrollment (locked roll) →
 * subject bulk insert (Workflow 3) → scoped waivers → invoice + accrual
 * journal (Accounting engine) → optional instant POS collection.
 * Any failure (misconfigured head, blocked Lillah, missing 4th subject)
 * rolls everything back — zero orphan rows (plan acceptance).
 *
 * Waiver scoping (scope_billing_types): each selected preset fans out to
 * an admission one-shot row ('ONE_TIME,TERM', active admission-day only)
 * and, when the preset grants tuition relief, an ongoing 'MONTHLY' row.
 * Lillah rows carry Fund 02; contra 41901–41904 resolves by waiver_type
 * inside the billing engine.
 */
@Injectable()
export class StudentOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: StudentBillingService,
    private readonly collection: FeeCollectionService,
    private readonly calc: WaiverCalculatorService,
    private readonly subjects: SubjectEnrollmentService,
    private readonly ids: StudentIdGeneratorService,
    private readonly rolls: RollNumberGeneratorService,
  ) {}

  /* ================= fee suggestion + dry preview ================= */

  /** Default admission set: ONE_TIME heads + SESSION + first TUITION. */
  async suggestFeeItems(): Promise<FeeSuggestItem[]> {
    const heads = await this.prisma.feeHeads.findMany({
      where: { isActive: true },
      orderBy: { headCode: 'asc' },
    });
    return heads
      .filter((h) => h.billingType === 'ONE_TIME' || ['SESSION', 'TUITION'].includes(h.headCode))
      .map((h) => ({
        feeHeadId: h.id,
        headCode: h.headCode,
        headName: h.headName,
        billingType: h.billingType,
        grossAmount: String(h.defaultAmount),
        isCautionDeposit: h.isCautionDeposit,
      }));
  }

  /**
   * Dry-run fee math for Step 5 (no writes). Mirrors
   * StudentBillingService.buildInvoice's waiver loop (sequential, capped,
   * scope-aware, caution-excluded) — keep the two in sync.
   */
  async previewFee(dto: FeePreviewDto) {
    const admissionDate = (dto.admissionDate ?? new Date().toISOString()).slice(0, 10);
    const items = await this.resolveItems(dto.feeItems);
    const family = dto.familyId
      ? await this.prisma.familyProfiles.findUnique({ where: { id: dto.familyId } })
      : null;
    if (dto.familyId && !family) throw new NotFoundException(`Family #${dto.familyId} not found`);
    const suggestions = await this.calc.calculate({
      prevGpa: dto.waiverInputs?.prevGpa,
      institutionType: dto.waiverInputs?.institutionType ?? undefined,
      quotaTag: dto.waiverInputs?.quotaTag ?? undefined,
      residenceType: dto.waiverInputs?.residenceType ?? undefined,
      familyId: dto.familyId,
    });
    const selected = this.pickAllowed(suggestions.suggestions, dto.applyWaiverRuleCodes ?? []);
    const waiverRows = this.buildWaiverRows(selected, admissionDate, null);
    const lines = items.map((it) => {
      const gross = new Decimal(it.grossAmount);
      let waiver = new Decimal(0);
      if (!it.isCautionDeposit) {
        let remaining = gross;
        for (const w of waiverRows) {
          if (w.scope && !w.scope.includes(it.billingType)) continue;
          const amt = Decimal.min(gross.times(w.percent).div(100).toDecimalPlaces(2), remaining);
          if (amt.lte(0)) continue;
          waiver = waiver.plus(amt);
          remaining = remaining.minus(amt);
          if (remaining.lte(0)) break;
        }
        waiver = Decimal.min(waiver, gross);
      }
      return {
        feeHeadId: it.feeHeadId,
        headCode: it.headCode,
        headName: it.headName,
        gross: gross.toFixed(2),
        waiver: waiver.toFixed(2),
        net: gross.minus(waiver).toFixed(2),
        isCautionDeposit: it.isCautionDeposit,
      };
    });
    const tot = (k: 'gross' | 'waiver' | 'net') =>
      lines.reduce((t, l) => t.plus(new Decimal(l[k])), new Decimal(0)).toFixed(2);
    return {
      lines,
      appliedWaivers: selected.map((s) => ({
        ruleCode: s.ruleCode,
        waiverType: s.waiverType,
        admissionFeePct: s.admissionFeePct,
        tuitionFeePct: s.tuitionFeePct,
      })),
      totals: { gross: tot('gross'), waiver: tot('waiver'), net: tot('net') },
    };
  }

  /* ================= atomic confirm ================= */

  async admit(dto: ConfirmAdmissionDto, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const admissionDate = dto.student.admissionDate.slice(0, 10);
        const year = String(new Date(admissionDate).getFullYear());

        /* ---- 1. family upsert ---- */
        let family: any = null;
        if (dto.family.familyId) {
          family = await tx.familyProfiles.findUnique({ where: { id: dto.family.familyId } });
          if (!family) throw new NotFoundException(`Family #${dto.family.familyId} not found`);
        } else {
          const phone = (dto.family.primaryGuardianPhone ?? '').trim();
          if (!phone || !dto.family.fatherNameEn?.trim() || !dto.family.motherNameEn?.trim() || !dto.family.presentAddress?.trim()) {
            throw new BadRequestException(
              'New family needs primaryGuardianPhone, fatherNameEn, motherNameEn and presentAddress',
            );
          }
          family = await tx.familyProfiles.findUnique({ where: { primaryGuardianPhone: phone } });
          if (!family) {
            if (dto.family.fatherNid && !isValidNid(dto.family.fatherNid)) {
              throw new BadRequestException('fatherNid must be a 10/13/17-digit NID');
            }
            family = await tx.familyProfiles.create({
              data: {
                familyCode: await this.ids.nextFamilyCode(tx, year),
                primaryGuardianPhone: phone,
                fatherNameEn: dto.family.fatherNameEn.trim(),
                fatherNameBn: dto.family.fatherNameBn ?? null,
                fatherNid: dto.family.fatherNid ?? null,
                fatherOccupation: dto.family.fatherOccupation ?? null,
                fatherMonthlyIncome: '0.00',
                isFatherDeceased: false,
                motherNameEn: dto.family.motherNameEn.trim(),
                motherPhone: dto.family.motherPhone ?? null,
                localGuardianName: dto.family.localGuardianName ?? null,
                localGuardianRelation: dto.family.localGuardianRelation ?? null,
                localGuardianPhone: dto.family.localGuardianPhone ?? null,
                presentAddress: dto.family.presentAddress!.trim(),
                upazilaThana: dto.family.upazilaThana ?? null,
                district: dto.family.district ?? null,
                isZakatEligibleFamily: dto.family.isZakatEligibleFamily ?? false,
              },
            });
          }
        }

        /* ---- 2. waivers: calculator is source of truth ---- */
        const p = dto.placement;
        const mergedInputs = {
          prevGpa: dto.waiverInputs?.prevGpa,
          institutionType: dto.waiverInputs?.institutionType ?? p.institutionType,
          quotaTag: dto.waiverInputs?.quotaTag ?? p.quotaTag,
          residenceType: dto.waiverInputs?.residenceType ?? p.residenceType,
        };
        const quota = (mergedInputs.quotaTag ?? '').trim().toUpperCase();
        const residence = (mergedInputs.residenceType ?? '').trim().toUpperCase();
        // Explicit Fund-02 gate (belt & braces on top of rule-level gating).
        if (
          (quota === 'ORPHAN_LILLAH' || residence === 'MADRASAH_LILLAH_BOARDER') &&
          !family.isZakatEligibleFamily
        ) {
          throw new BadRequestException(
            `Blocked: family ${family.familyCode} is not verified zakat-eligible (Fund 02 rule).`,
          );
        }
        const { suggestions } = await this.calc.calculate({ ...mergedInputs, familyId: family.id }, tx);
        const selected = this.pickAllowed(suggestions, dto.applyWaiverRuleCodes ?? []);

        /* ---- 3. student identity ---- */
        if (dto.student.birthRegNo && !isValidBrn(dto.student.birthRegNo)) {
          throw new BadRequestException('birthRegNo must be a 17-digit BRN');
        }
        if (dto.student.nationalIdNo && !isValidNid(dto.student.nationalIdNo)) {
          throw new BadRequestException('nationalIdNo must be a 10/13/17-digit NID');
        }
        const student = await tx.students.create({
          data: {
            studentUniqueId: await this.ids.nextStudentId(tx, year),
            familyProfileId: family.id,
            fullNameEn: dto.student.fullNameEn.trim(),
            fullNameBn: dto.student.fullNameBn ?? null,
            gender: dto.student.gender.trim().toUpperCase(),
            dateOfBirth: dto.student.dateOfBirth.slice(0, 10),
            birthRegNo: dto.student.birthRegNo ?? null,
            nationalIdNo: dto.student.nationalIdNo ?? null,
            religion: dto.student.religion.trim().toUpperCase(),
            bloodGroup: dto.student.bloodGroup ?? null,
            photoUrl: dto.student.photoUrl ?? null,
            medicalAllergyNotes: dto.student.medicalAllergyNotes ?? null,
            stipendMfsType: dto.student.stipendMfsType ?? null,
            stipendAccountNo: dto.student.stipendAccountNo ?? null,
            pickupGuardianName: dto.student.pickupGuardianName ?? null,
            pickupGuardianPhone: dto.student.pickupGuardianPhone ?? null,
            admissionDate,
            currentStatus: 'ACTIVE',
          },
        });

        /* ---- 4. previous education trail ---- */
        if (dto.previousEducations?.length) {
          await tx.studentPreviousEducations.createMany({
            data: dto.previousEducations.map((e) => ({
              studentId: student.id,
              examTitle: e.examTitle,
              instituteName: e.instituteName,
              educationBoard: e.educationBoard ?? null,
              academicGroup: e.academicGroup ?? null,
              rollNo: e.rollNo ?? null,
              regNo: e.regNo ?? null,
              passingYear: e.passingYear ?? null,
              gpaObtained: e.gpaObtained ?? null,
              gpaScale: '5.00',
              tcNumber: e.tcNumber ?? null,
              tcDate: e.tcDate ?? null,
            })),
          });
        }

        /* ---- 5. enrollment (locked roll) ---- */
        const roll = await this.rolls.nextRoll(tx, p.academicSessionId, p.classOrDeptId, p.sectionOrBatchId);
        try {
          await tx.studentEnrollments.create({
            data: {
              studentId: student.id,
              academicSessionId: p.academicSessionId,
              institutionType: p.institutionType.trim().toUpperCase(),
              classOrDeptId: p.classOrDeptId,
              shiftId: p.shiftId ?? null,
              sectionOrBatchId: p.sectionOrBatchId ?? null,
              academicGroup: (p.academicGroup ?? 'GENERAL').trim().toUpperCase(),
              classRollNo: roll,
              boardRegistrationNo: p.boardRegistrationNo ?? null,
              enrollmentType: (p.enrollmentType ?? 'NEW_ADMISSION').trim().toUpperCase(),
              residenceType: (p.residenceType ?? 'DAY_SCHOLAR').trim().toUpperCase(),
              hostelSeatId: p.hostelSeatId ?? null,
              transportRouteId: p.transportRouteId ?? null,
              quotaTag: (p.quotaTag ?? 'NONE').trim().toUpperCase(),
              isActive: true,
            },
          });
        } catch (e) {
          throw new BadRequestException(
            `Roll collision in this class/section — retry confirm (${e instanceof Error ? e.message : e})`,
          );
        }

        /* ---- 6. subjects (Workflow 3, same txn) ---- */
        if (p.syllabusSubjectIds?.length) {
          await this.subjects.enroll(student.id, p.academicSessionId, p.syllabusSubjectIds, tx);
        }

        /* ---- 7. admission waiver rows ---- */
        const lillahFund = selected.some((s) => s.waiverType === 'LILLAH_ZAKAT_ORPHAN')
          ? await tx.funds.findUnique({ where: { fundCode: '02' } })
          : null;
        if (selected.some((s) => s.waiverType === 'LILLAH_ZAKAT_ORPHAN') && !lillahFund) {
          throw new BadRequestException('Fund 02 (Lillah/Zakat) missing — run seed:accounting');
        }
        await tx.studentWaivers.createMany({
          data: this.buildWaiverRows(selected, admissionDate, lillahFund?.id ?? null).map((w) => ({
            studentId: student.id,
            waiverType: w.waiverType,
            percent: w.percent,
            fixedCapAmount: null,
            contraGlId: null,
            fundId: w.fundId,
            activeFrom: w.activeFrom,
            activeTo: w.activeTo,
            isActive: true,
            remark: w.remark,
          })),
        });

        /* ---- 8. admission invoice + accrual journal ---- */
        const items = await this.resolveItems(dto.feeItems, tx);
        const billingPeriod = await this.admissionPeriod(tx, student.id, year);
        const dueDate = (dto.dueDate ?? this.plusDays(admissionDate, 30)).slice(0, 10);
        const invoice = await this.billing.createInvoiceIn(
          tx,
          {
            studentId: student.id,
            billingPeriod,
            issueDate: admissionDate,
            dueDate,
            narration:
              dto.narration ??
              `Admission ${year} — ${student.studentUniqueId} (family ${family.familyCode})`,
            items: items.map((it) => ({ feeHeadId: it.feeHeadId, amount: it.grossAmount })),
          },
          actorId,
        );

        /* ---- 9. optional instant POS collection ---- */
        let receipt: { id: string; moneyReceiptNo: string } | null = null;
        if (dto.collectNow) {
          const c = dto.collectNow;
          if (!(PAYMENT_CHANNELS as string[]).includes(c.paymentChannel)) {
            throw new BadRequestException(`paymentChannel must be one of ${PAYMENT_CHANNELS.join(', ')}`);
          }
          const due = new Decimal(invoice.netAmount)
            .plus(new Decimal(invoice.lateFineAmount))
            .minus(new Decimal(invoice.paidAmount));
          const amount = c.amount ? new Decimal(c.amount) : due;
          if (amount.lte(0)) throw new BadRequestException('Nothing due on this invoice');
          if (amount.gt(due)) {
            throw new BadRequestException(`Amount ${amount.toFixed(2)} exceeds due ${due.toFixed(2)}`);
          }
          const paid = await this.collection.collectIn(
            tx,
            {
              studentId: student.id,
              invoiceId: invoice.id,
              amount: amount.toFixed(2),
              paymentChannel: c.paymentChannel as (typeof PAYMENT_CHANNELS)[number],
              cashGlId: c.cashGlId ?? null,
              gatewayTrxId: c.gatewayTrxId ?? null,
              bankReference: c.bankReference ?? null,
              remark: c.remark ?? `Admission POS — ${student.studentUniqueId}`,
            },
            actorId,
          );
          receipt = { id: paid.id, moneyReceiptNo: paid.moneyReceiptNo };
        }

        /* ---- 10. close the pre-admission loop (Phase 2 → Phase 3) ---- */
        // Same transaction: if this admission came from an online/walk-in
        // application, flip it to ADMITTED and link the created student. A
        // failed admission therefore never leaves a falsely-admitted applicant.
        let application: { id: string; applicationNo: string } | null = null;
        if (dto.applicationId) {
          const app = await tx.admissionApplications.findUnique({ where: { id: dto.applicationId } });
          if (!app) throw new NotFoundException(`Application #${dto.applicationId} not found`);
          if (app.status === 'ADMITTED') {
            throw new BadRequestException(`${app.applicationNo} is already admitted`);
          }
          if (app.status === 'REJECTED') {
            throw new BadRequestException(`${app.applicationNo} was rejected — cannot admit`);
          }
          await tx.admissionApplications.update({
            where: { id: app.id },
            data: { status: 'ADMITTED', admittedStudentId: student.id },
          });
          application = { id: app.id, applicationNo: app.applicationNo };
        }

        return {
          studentId: student.id,
          studentUniqueId: student.studentUniqueId,
          familyId: family.id,
          familyCode: family.familyCode,
          classRollNo: roll,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          grossAmount: invoice.grossAmount,
          waiverAmount: invoice.waiverAmount,
          netAmount: invoice.netAmount,
          moneyReceiptNo: receipt?.moneyReceiptNo ?? null,
          receiptId: receipt?.id ?? null,
          applicationId: application?.id ?? null,
          applicationNo: application?.applicationNo ?? null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ================= internals (IDs/rolls now live in common/ generators) ================= */

  private pickAllowed(suggestions: WaiverSuggestion[], codes: string[]): WaiverSuggestion[] {
    const wanted = new Set(codes);
    const selected = suggestions.filter((s) => wanted.has(s.ruleCode));
    if (selected.length !== wanted.size) {
      const known = new Set(suggestions.map((s) => s.ruleCode));
      const bad = codes.filter((c) => !known.has(c));
      throw new BadRequestException(`Waiver rule(s) not applicable: ${bad.join(', ') || codes.join(', ')}`);
    }
    const blocked = selected.filter((s) => !s.allowed);
    if (blocked.length > 0) {
      throw new BadRequestException(blocked.map((s) => `${s.ruleCode}: ${s.reason}`).join(' | '));
    }
    return selected;
  }

  private buildWaiverRows(
    selected: WaiverSuggestion[],
    admissionDate: string,
    lillahFundId: string | null,
  ): Array<{
    waiverType: string; percent: string; scope: string;
    fundId: string | null; activeFrom: string; activeTo: string | null; remark: string;
  }> {
    const rows: Array<{
      waiverType: string; percent: string; scope: string;
      fundId: string | null; activeFrom: string; activeTo: string | null; remark: string;
    }> = [];
    for (const s of selected) {
      const adm = new Decimal(s.admissionFeePct);
      const tui = new Decimal(s.tuitionFeePct);
      const waiverType = s.waiverType as string;
      const fundId = s.waiverType === 'LILLAH_ZAKAT_ORPHAN' ? lillahFundId : null;
      if (adm.gt(0)) {
        rows.push({
          waiverType,
          percent: adm.toFixed(2),
          scope: 'ONE_TIME,TERM',
          fundId,
          activeFrom: admissionDate,
          activeTo: admissionDate, // one-shot: admission-day invoices only
          remark: `Admission-time ${s.ruleCode}`,
        });
      }
      if (tui.gt(0)) {
        rows.push({
          waiverType,
          percent: tui.toFixed(2),
          scope: 'MONTHLY',
          fundId,
          activeFrom: admissionDate,
          activeTo: null, // ongoing tuition relief
          remark: `Tuition ${s.ruleCode} from admission`,
        });
      }
    }
    return rows;
  }

  private async resolveItems(
    feeItems?: Array<{ feeHeadId: string; amount?: string }>,
    tx?: PrismaTypes.TransactionClient,
  ): Promise<FeeSuggestItem[]> {
    const repo = tx ?? this.prisma;
    if (feeItems?.length) {
      const out: FeeSuggestItem[] = [];
      for (const it of feeItems) {
        const head = await repo.feeHeads.findUnique({ where: { id: it.feeHeadId } });
        if (!head) throw new NotFoundException(`Fee head #${it.feeHeadId} not found`);
        if (!head.isActive) throw new BadRequestException(`Fee head "${head.headCode}" is inactive`);
        let gross: string = String(head.defaultAmount);
        if (it.amount !== undefined) {
          gross = this.money(it.amount, `amount(${head.headCode})`);
        } else if (head.billingType === 'CREDIT_HOUR') {
          throw new BadRequestException(`"${head.headCode}" is per-credit — pass an explicit amount`);
        }
        if (new Decimal(gross).lte(0)) throw new BadRequestException(`"${head.headCode}" gross must be positive`);
        out.push({
          feeHeadId: head.id,
          headCode: head.headCode,
          headName: head.headName,
          billingType: head.billingType,
          grossAmount: gross,
          isCautionDeposit: head.isCautionDeposit,
        });
      }
      return out;
    }
    return this.suggestFeeItems();
  }

  /** Unique admission period per student (ADM-2026, ADM-2026-2 on re-admit). */
  private async admissionPeriod(tx: PrismaTypes.TransactionClient, studentId: string, year: string): Promise<string> {
    const base = `ADMISSION-${year}`;
    if (!(await tx.studentInvoices.findFirst({ where: { studentId, billingPeriod: base } }))) return base;
    for (let n = 2; n < 100; n += 1) {
      const p = `${base}-${n}`;
      if (!(await tx.studentInvoices.findFirst({ where: { studentId, billingPeriod: p } }))) return p;
    }
    throw new BadRequestException('Too many admission invoices for this student/year');
  }

  private plusDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private money(raw: string, tag: string): string {
    let d: Decimal;
    try {
      d = new Decimal(raw);
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid decimal`);
    }
    if (!d.isFinite() || d.isNegative()) throw new BadRequestException(`${tag} must be non-negative`);
    return d.toFixed(2);
  }

}
