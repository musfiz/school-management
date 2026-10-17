import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { toDateValue, toDateOnly } from '../prisma/wire';
import type { AdmissionApplications, AdmissionCampaigns } from '../generated/prisma/client';
import { ADMISSION_APPLICATION_STATUSES } from '../database/entities/admission-application.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { Fund } from '../database/entities/fund.entity';
import { JournalPostingService } from '../accounting/journal-posting.service';
import type { JournalLineDto } from '../accounting/vouchers.dto';
import { StudentIdGeneratorService } from './common/student-id-generator.service';
import type { Prisma as PrismaTypes } from '../generated/prisma/client';

const MANUAL_STATUSES: AdmissionApplicationStatus[] = ['SHORTLISTED', 'WAITING', 'REJECTED'];

/** Application row with Prisma's `admissionCampaigns` relation exposed under the entity's `campaign` key. */
export type ApplicationWithCampaign = Omit<AdmissionApplications, 'admissionCampaigns'> & {
  campaign?: AdmissionCampaigns | null;
};

type AdmissionApplicationStatus = (typeof ADMISSION_APPLICATION_STATUSES)[number];

function toApplicationWithCampaign(
  row: AdmissionApplications & { admissionCampaigns?: AdmissionCampaigns | null },
): ApplicationWithCampaign {
  const { admissionCampaigns, ...rest } = row;
  return { ...rest, campaign: admissionCampaigns ?? null };
}

/**
 * Phase 2 — Pre-Admission Application API (Plan Phase 2).
 * Campaigns → walk-in/online intake (eligibility-gated) → form-fee
 * collection (GL 44102) → bulk test marks + competition-rank merit list →
 * convert-to-draft for the Direct Admission Wizard.
 *
 * `collectFormFee` runs through the Wave 5 `JournalPostingService` (now
 * Prisma-based) inside a Prisma transaction.
 */
@Injectable()
export class AdmissionApplicationService {
  constructor(
    private readonly posting: JournalPostingService,
    private readonly ids: StudentIdGeneratorService,
    private readonly prisma: PrismaService,
  ) {}

  /* ================= campaigns ================= */

  listCampaigns(activeOnly = false): Promise<AdmissionCampaigns[]> {
    return this.prisma.admissionCampaigns.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { startDate: 'desc' },
    });
  }

  async createCampaign(dto: {
    academicSessionId: string; classOrDeptId: string; campaignTitle: string;
    applicationFee?: string; totalSeats: number; minRequiredGpa?: string;
    startDate: string; endDate: string; isActive?: boolean;
  }): Promise<AdmissionCampaigns> {
    const start = dto.startDate.slice(0, 10);
    const end = dto.endDate.slice(0, 10);
    if (end < start) throw new BadRequestException('endDate cannot precede startDate');
    return this.prisma.admissionCampaigns.create({
      data: {
        academicSessionId: dto.academicSessionId,
        classOrDeptId: dto.classOrDeptId,
        campaignTitle: dto.campaignTitle.trim(),
        applicationFee: this.money(dto.applicationFee ?? '0', 'applicationFee'),
        totalSeats: dto.totalSeats,
        minRequiredGpa: this.gpa(dto.minRequiredGpa ?? '0', 'minRequiredGpa'),
        startDate: toDateValue(start),
        endDate: toDateValue(end),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCampaign(id: string, dto: Record<string, unknown>): Promise<AdmissionCampaigns> {
    const c = await this.prisma.admissionCampaigns.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Campaign #${id} not found`);
    const data: Prisma.AdmissionCampaignsUpdateInput = {};
    if (dto.campaignTitle !== undefined) data.campaignTitle = String(dto.campaignTitle).trim();
    if (dto.applicationFee !== undefined) data.applicationFee = this.money(String(dto.applicationFee), 'applicationFee');
    if (dto.totalSeats !== undefined) data.totalSeats = Number(dto.totalSeats);
    if (dto.minRequiredGpa !== undefined) data.minRequiredGpa = this.gpa(String(dto.minRequiredGpa), 'minRequiredGpa');
    if (dto.startDate !== undefined) data.startDate = toDateValue(String(dto.startDate).slice(0, 10));
    if (dto.endDate !== undefined) data.endDate = toDateValue(String(dto.endDate).slice(0, 10));
    const start = data.startDate !== undefined ? toDateOnly(data.startDate as Date) : toDateOnly(c.startDate);
    const end = data.endDate !== undefined ? toDateOnly(data.endDate as Date) : toDateOnly(c.endDate);
    if (end < start) throw new BadRequestException('endDate cannot precede startDate');
    if (dto.isActive !== undefined) data.isActive = Boolean(dto.isActive);
    return this.prisma.admissionCampaigns.update({ where: { id }, data });
  }

  /* ================= intake ================= */

  async listApplications(filters: { campaignId?: string; status?: string; limit?: number }) {
    const where: Prisma.AdmissionApplicationsWhereInput = {};
    if (filters.campaignId) where.campaignId = filters.campaignId;
    if (filters.status) where.status = filters.status;
    const rows = await this.prisma.admissionApplications.findMany({
      where,
      include: { admissionCampaigns: true },
      // Ranked applicants first (ascending), unranked (NULL) last. MySQL/MariaDB
      // have no `NULLS LAST`, so Prisma sorts on the IS NULL flag first.
      orderBy: [
        { meritRank: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: Math.min(Math.max(filters.limit ?? 200, 1), 1000),
    });
    return rows.map(toApplicationWithCampaign);
  }

  async submit(dto: {
    campaignId: string; applicantNameEn: string; applicantNameBn?: string | null;
    gender: string; dateOfBirth: string; birthRegNo?: string | null; guardianPhone: string;
    prevExamName?: string | null; prevBoard?: string | null; prevRollNo?: string | null;
    prevRegNo?: string | null; prevPassingYear?: number | null; prevGpa?: string | null;
    quotaApplied?: string | null;
  }): Promise<AdmissionApplications> {
    const campaign = await this.prisma.admissionCampaigns.findUnique({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign #${dto.campaignId} not found`);
    const today = new Date().toISOString().slice(0, 10);
    if (!campaign.isActive) throw new BadRequestException(`"${campaign.campaignTitle}" is not active`);
    const startDate = toDateOnly(campaign.startDate);
    const endDate = toDateOnly(campaign.endDate);
    if (today < startDate || today > endDate) {
      throw new BadRequestException(
        `"${campaign.campaignTitle}" accepts applications ${startDate}–${endDate}`,
      );
    }
    // Eligibility gate: below-minimum GPA is rejected at intake, not at admit.
    if (dto.prevGpa != null && String(dto.prevGpa).trim() !== '') {
      const gpa = this.gpa(String(dto.prevGpa), 'prevGpa');
      if (new Decimal(gpa).lt(new Decimal(String(campaign.minRequiredGpa)))) {
        throw new BadRequestException(
          `GPA ${gpa} is below the ${campaign.minRequiredGpa} minimum for "${campaign.campaignTitle}"`,
        );
      }
    }
    const year = String(new Date().getFullYear());
    const applicationNo = await this.prisma.$transaction(
      (tx) => this.ids.nextApplicationNo(tx, year),
      { isolationLevel: 'RepeatableRead' },
    );
    return this.prisma.admissionApplications.create({
      data: {
        applicationNo,
        campaignId: campaign.id,
        applicantNameEn: dto.applicantNameEn.trim(),
        applicantNameBn: dto.applicantNameBn ?? null,
        gender: dto.gender.trim().toUpperCase(),
        dateOfBirth: toDateValue(dto.dateOfBirth.slice(0, 10)),
        birthRegNo: dto.birthRegNo ?? null,
        guardianPhone: dto.guardianPhone.trim(),
        prevExamName: dto.prevExamName ?? null,
        prevBoard: dto.prevBoard ?? null,
        prevRollNo: dto.prevRollNo ?? null,
        prevRegNo: dto.prevRegNo ?? null,
        prevPassingYear: dto.prevPassingYear ?? null,
        prevGpa: dto.prevGpa != null && String(dto.prevGpa).trim() !== '' ? this.gpa(String(dto.prevGpa), 'prevGpa') : null,
        admissionTestMarks: '0.00',
        quotaApplied: dto.quotaApplied ?? null,
        formFeePaid: false,
        status: 'APPLIED',
      },
    });
  }

  async setStatus(id: string, status: string): Promise<ApplicationWithCampaign> {
    if (!(ADMISSION_APPLICATION_STATUSES as string[]).includes(status)) {
      throw new BadRequestException(`status must be one of ${ADMISSION_APPLICATION_STATUSES.join(', ')}`);
    }
    if (status === 'ADMITTED') {
      throw new BadRequestException('ADMITTED is set only by the admission confirm flow — use convert-to-draft');
    }
    const app = await this.prisma.admissionApplications.findUnique({
      where: { id },
      include: { admissionCampaigns: true },
    });
    if (!app) throw new NotFoundException(`Application #${id} not found`);
    if (app.status === 'ADMITTED') throw new BadRequestException('Already admitted — status is final');
    const updated = await this.prisma.admissionApplications.update({
      where: { id },
      data: { status: status as AdmissionApplicationStatus },
      include: { admissionCampaigns: true },
    });
    return toApplicationWithCampaign(updated);
  }

  /* ================= test marks + merit rank ================= */

  /**
   * Bulk marks entry + automatic competition-rank merit list per campaign
   * (ties share a rank: 1, 2, 2, 4). Unmarked rows keep NULL rank.
   */
  async bulkTestMarks(campaignId: string, marks: Array<{ applicationId: string; marks: string }>) {
    return this.prisma.$transaction(
      async (tx) => {
        for (const row of marks) {
          const app = await tx.admissionApplications.findUnique({ where: { id: row.applicationId } });
          if (!app) throw new NotFoundException(`Application #${row.applicationId} not found`);
          if (app.campaignId !== campaignId) {
            throw new BadRequestException(`${app.applicationNo} belongs to a different campaign`);
          }
          const value = this.marks(row.marks);
          await tx.admissionApplications.update({
            where: { id: app.id },
            data: { admissionTestMarks: value },
          });
        }
        const all = await tx.admissionApplications.findMany({
          where: { campaignId },
          orderBy: { admissionTestMarks: 'desc' },
        });
        let rank = 0;
        let seen = 0;
        let last: string | null = null;
        for (const app of all) {
          seen += 1;
          const current = String(app.admissionTestMarks);
          if (new Decimal(current).lte(0)) {
            await tx.admissionApplications.update({
              where: { id: app.id },
              data: { meritRank: null },
            });
          } else {
            if (last === null || new Decimal(current).lt(new Decimal(last))) rank = seen;
            await tx.admissionApplications.update({
              where: { id: app.id },
              data: { meritRank: rank },
            });
            last = current;
          }
        }
        return tx.admissionApplications.findMany({
          where: { campaignId },
          orderBy: { admissionTestMarks: 'desc' },
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ================= form-fee collection (GL 44102) ================= */

  /**
   * Prospectus / form fee: Dr Cash 11101 (or override) / Cr 44102 Sale of
   * Admission Forms, Fund 01, source ADMISSION. Marks form_fee_paid in the
   * same transaction — a receipt mis-post never strands a paid flag.
   */
  async collectFormFee(
    id: string,
    opts: { paymentChannel?: string; amount?: string; cashGlId?: string | null; remark?: string | null },
    actorId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const app = await tx.admissionApplications.findUnique({ where: { id } });
        if (!app) throw new NotFoundException(`Application #${id} not found`);
        if (app.formFeePaid) throw new BadRequestException(`${app.applicationNo} form fee is already paid`);
        const campaign = await tx.admissionCampaigns.findUnique({ where: { id: app.campaignId } });
        if (!campaign) throw new BadRequestException('Campaign not found');
        const amount = this.money(String(opts.amount ?? campaign.applicationFee), 'amount');
        if (new Decimal(amount).lte(0)) {
          throw new BadRequestException('No form fee configured for this campaign (application_fee is 0)');
        }
        const cashGl = await this.gl(tx, opts.cashGlId ?? '11101');
        const formGl = await this.gl(tx, '44102');
        const fund = await tx.funds.findUnique({ where: { fundCode: '01' } });
        if (!fund) throw new BadRequestException('Fund 01 (General) missing — run seed:accounting');
        const today = new Date().toISOString().slice(0, 10);
        const journal = await this.posting.postSystemJournal(tx, {
          voucherType: 'RECEIVE',
          transactionDate: today,
          narration: opts.remark ?? `Form fee ${app.applicationNo} — ${app.applicantNameEn} (${amount})`,
          sourceModule: 'ADMISSION',
          sourceReferenceId: app.id,
          actorId,
          lines: [
            {
              glAccountId: cashGl.id, fundId: fund.id, costCenterId: null,
              debitAmount: new Decimal(amount).toFixed(2), creditAmount: '0.00',
              lineMemo: `Form fee ${app.applicationNo}${opts.paymentChannel ? ` (${opts.paymentChannel})` : ''}`,
            },
            {
              glAccountId: formGl.id, fundId: fund.id, costCenterId: null,
              debitAmount: '0.00', creditAmount: new Decimal(amount).toFixed(2),
              lineMemo: `44102 ${app.applicationNo}`,
            },
          ] as JournalLineDto[],
        });
        await tx.admissionApplications.update({
          where: { id: app.id },
          data: { formFeePaid: true },
        });
        return {
          applicationId: app.id,
          applicationNo: app.applicationNo,
          amount: new Decimal(amount).toFixed(2),
          journalId: journal.id,
          voucherNo: (journal as { voucherNo: string }).voucherNo,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  /* ================= convert to admission draft ================= */

  /**
   * Pre-fill the Direct Admission Wizard from an approved applicant.
   * The wizard opens at Step 1 with the guardian phone queued (lookup →
   * auto-fill / new family) and Step 4 inputs pre-seeded from prev GPA +
   * quota. Admit still runs the full atomic flow — this only skips typing.
   */
  async convertToDraft(id: string) {
    const row = await this.prisma.admissionApplications.findUnique({
      where: { id },
      include: { admissionCampaigns: true },
    });
    if (!row) throw new NotFoundException(`Application #${id} not found`);
    if (row.status === 'REJECTED') throw new BadRequestException('Rejected applications cannot convert');
    if (row.status === 'ADMITTED') throw new BadRequestException('Already admitted');
    const app = toApplicationWithCampaign(row);
    return {
      application: app,
      wizardQuery: app.guardianPhone,
      studentPrefill: {
        fullNameEn: app.applicantNameEn,
        fullNameBn: app.applicantNameBn,
        gender: app.gender,
        dateOfBirth: app.dateOfBirth,
        birthRegNo: app.birthRegNo,
      },
      waiverPrefill: {
        prevGpa: app.prevGpa,
        quotaTag: app.quotaApplied,
      },
      hint: `Open the wizard with ?query=${encodeURIComponent(app.guardianPhone)} — Step 1 lookup, Step 4 GPA/quota pre-filled`,
    };
  }

  /* ================= internals ================= */

  private async gl(tx: PrismaTypes.TransactionClient, codeOrId: string) {
    const byId = await tx.chartOfAccounts.findUnique({ where: { id: codeOrId } });
    if (byId) return byId;
    const byCode = await tx.chartOfAccounts.findUnique({ where: { glCode: codeOrId } });
    if (!byCode) throw new BadRequestException(`GL ${codeOrId} missing — run seed:accounting`);
    return byCode;
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

  private gpa(raw: string, tag: string): string {
    let d: Decimal;
    try {
      d = new Decimal(raw);
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid decimal`);
    }
    if (!d.isFinite() || d.isNegative() || d.gt(5)) throw new BadRequestException(`${tag} must be 0.00–5.00`);
    return d.toFixed(2);
  }

  private marks(raw: string): string {
    let d: Decimal;
    try {
      d = new Decimal(raw);
    } catch {
      throw new BadRequestException(`marks "${raw}" is not a valid decimal`);
    }
    if (!d.isFinite() || d.isNegative() || d.gt(1000)) {
      throw new BadRequestException('marks must be 0–1000');
    }
    return d.toFixed(2);
  }

}
