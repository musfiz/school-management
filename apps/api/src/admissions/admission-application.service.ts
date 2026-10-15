import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { AdmissionCampaign } from '../database/entities/admission-campaign.entity';
import {
  AdmissionApplication,
  ADMISSION_APPLICATION_STATUSES,
  AdmissionApplicationStatus,
} from '../database/entities/admission-application.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';
import { Fund } from '../database/entities/fund.entity';
import { JournalPostingService } from '../accounting/journal-posting.service';
import type { JournalLineDto } from '../accounting/vouchers.dto';
import { StudentIdGeneratorService } from './common/student-id-generator.service';

const MANUAL_STATUSES: AdmissionApplicationStatus[] = ['SHORTLISTED', 'WAITING', 'REJECTED'];

/**
 * Phase 2 — Pre-Admission Application API (Plan Phase 2).
 * Campaigns → walk-in/online intake (eligibility-gated) → form-fee
 * collection (GL 44102) → bulk test marks + competition-rank merit list →
 * convert-to-draft for the Direct Admission Wizard.
 */
@Injectable()
export class AdmissionApplicationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly posting: JournalPostingService,
    private readonly ids: StudentIdGeneratorService,
    @InjectRepository(AdmissionCampaign) private readonly campaigns: Repository<AdmissionCampaign>,
    @InjectRepository(AdmissionApplication) private readonly applications: Repository<AdmissionApplication>,
  ) {}

  /* ================= campaigns ================= */

  listCampaigns(activeOnly = false): Promise<AdmissionCampaign[]> {
    return this.campaigns.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: { startDate: 'DESC' },
    });
  }

  async createCampaign(dto: {
    academicSessionId: string; classOrDeptId: string; campaignTitle: string;
    applicationFee?: string; totalSeats: number; minRequiredGpa?: string;
    startDate: string; endDate: string; isActive?: boolean;
  }): Promise<AdmissionCampaign> {
    const start = dto.startDate.slice(0, 10);
    const end = dto.endDate.slice(0, 10);
    if (end < start) throw new BadRequestException('endDate cannot precede startDate');
    return this.campaigns.save(
      this.campaigns.create({
        academicSessionId: dto.academicSessionId,
        classOrDeptId: dto.classOrDeptId,
        campaignTitle: dto.campaignTitle.trim(),
        applicationFee: this.money(dto.applicationFee ?? '0', 'applicationFee'),
        totalSeats: dto.totalSeats,
        minRequiredGpa: this.gpa(dto.minRequiredGpa ?? '0', 'minRequiredGpa'),
        startDate: start,
        endDate: end,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateCampaign(id: string, dto: Record<string, unknown>): Promise<AdmissionCampaign> {
    const c = await this.campaigns.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Campaign #${id} not found`);
    if (dto.campaignTitle !== undefined) c.campaignTitle = String(dto.campaignTitle).trim();
    if (dto.applicationFee !== undefined) c.applicationFee = this.money(String(dto.applicationFee), 'applicationFee');
    if (dto.totalSeats !== undefined) c.totalSeats = Number(dto.totalSeats);
    if (dto.minRequiredGpa !== undefined) c.minRequiredGpa = this.gpa(String(dto.minRequiredGpa), 'minRequiredGpa');
    if (dto.startDate !== undefined) c.startDate = String(dto.startDate).slice(0, 10);
    if (dto.endDate !== undefined) c.endDate = String(dto.endDate).slice(0, 10);
    if (c.endDate < c.startDate) throw new BadRequestException('endDate cannot precede startDate');
    if (dto.isActive !== undefined) c.isActive = Boolean(dto.isActive);
    return this.campaigns.save(c);
  }

  /* ================= intake ================= */

  listApplications(filters: { campaignId?: string; status?: string; limit?: number }) {
    const qb = this.applications
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.campaign', 'campaign')
      // Ranked applicants first (ascending), unranked (NULL) last. MySQL/MariaDB
      // have no `NULLS LAST`, so sort on the IS NULL flag first.
      .orderBy('a.meritRank IS NULL', 'ASC')
      .addOrderBy('a.meritRank', 'ASC')
      .addOrderBy('a.createdAt', 'DESC')
      // `limit` (not `take`): the join is ManyToOne so no row multiplication,
      // and `take`'s distinct-id pagination can't handle an expression ORDER BY.
      .limit(Math.min(Math.max(filters.limit ?? 200, 1), 1000));
    if (filters.campaignId) qb.andWhere('a.campaignId = :c', { c: filters.campaignId });
    if (filters.status) qb.andWhere('a.status = :s', { s: filters.status });
    return qb.getMany();
  }

  async submit(dto: {
    campaignId: string; applicantNameEn: string; applicantNameBn?: string | null;
    gender: string; dateOfBirth: string; birthRegNo?: string | null; guardianPhone: string;
    prevExamName?: string | null; prevBoard?: string | null; prevRollNo?: string | null;
    prevRegNo?: string | null; prevPassingYear?: number | null; prevGpa?: string | null;
    quotaApplied?: string | null;
  }): Promise<AdmissionApplication> {
    const campaign = await this.campaigns.findOne({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign #${dto.campaignId} not found`);
    const today = new Date().toISOString().slice(0, 10);
    if (!campaign.isActive) throw new BadRequestException(`"${campaign.campaignTitle}" is not active`);
    if (today < campaign.startDate || today > campaign.endDate) {
      throw new BadRequestException(
        `"${campaign.campaignTitle}" accepts applications ${campaign.startDate}–${campaign.endDate}`,
      );
    }
    // Eligibility gate: below-minimum GPA is rejected at intake, not at admit.
    if (dto.prevGpa != null && String(dto.prevGpa).trim() !== '') {
      const gpa = this.gpa(String(dto.prevGpa), 'prevGpa');
      if (new Decimal(gpa).lt(new Decimal(campaign.minRequiredGpa))) {
        throw new BadRequestException(
          `GPA ${gpa} is below the ${campaign.minRequiredGpa} minimum for "${campaign.campaignTitle}"`,
        );
      }
    }
    const year = String(new Date().getFullYear());
    const applicationNo = await this.dataSource.transaction('REPEATABLE READ', (m) =>
      this.ids.nextApplicationNo(m, year),
    );
    return this.applications.save(
      this.applications.create({
        applicationNo,
        campaignId: campaign.id,
        applicantNameEn: dto.applicantNameEn.trim(),
        applicantNameBn: dto.applicantNameBn ?? null,
        gender: dto.gender.trim().toUpperCase(),
        dateOfBirth: dto.dateOfBirth.slice(0, 10),
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
      }),
    );
  }

  async setStatus(id: string, status: string): Promise<AdmissionApplication> {
    if (!(ADMISSION_APPLICATION_STATUSES as string[]).includes(status)) {
      throw new BadRequestException(`status must be one of ${ADMISSION_APPLICATION_STATUSES.join(', ')}`);
    }
    if (status === 'ADMITTED') {
      throw new BadRequestException('ADMITTED is set only by the admission confirm flow — use convert-to-draft');
    }
    const app = await this.applications.findOne({ where: { id }, relations: ['campaign'] });
    if (!app) throw new NotFoundException(`Application #${id} not found`);
    if (app.status === 'ADMITTED') throw new BadRequestException('Already admitted — status is final');
    app.status = status as AdmissionApplicationStatus;
    return this.applications.save(app);
  }

  /* ================= test marks + merit rank ================= */

  /**
   * Bulk marks entry + automatic competition-rank merit list per campaign
   * (ties share a rank: 1, 2, 2, 4). Unmarked rows keep NULL rank.
   */
  async bulkTestMarks(campaignId: string, marks: Array<{ applicationId: string; marks: string }>) {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const repo = m.getRepository(AdmissionApplication);
      for (const row of marks) {
        const app = await repo.findOne({ where: { id: row.applicationId } });
        if (!app) throw new NotFoundException(`Application #${row.applicationId} not found`);
        if (app.campaignId !== campaignId) {
          throw new BadRequestException(`${app.applicationNo} belongs to a different campaign`);
        }
        const value = this.marks(row.marks);
        app.admissionTestMarks = value;
        await repo.save(app);
      }
      const all = await repo.find({ where: { campaignId }, order: { admissionTestMarks: 'DESC' } });
      let rank = 0;
      let seen = 0;
      let last: string | null = null;
      for (const app of all) {
        seen += 1;
        if (new Decimal(app.admissionTestMarks).lte(0)) {
          app.meritRank = null;
        } else {
          if (last === null || new Decimal(app.admissionTestMarks).lt(new Decimal(last))) rank = seen;
          app.meritRank = rank;
          last = app.admissionTestMarks;
        }
        await repo.save(app);
      }
      return repo.find({ where: { campaignId }, order: { admissionTestMarks: 'DESC' } });
    });
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
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const repo = m.getRepository(AdmissionApplication);
      const app = await repo.findOne({ where: { id } });
      if (!app) throw new NotFoundException(`Application #${id} not found`);
      if (app.formFeePaid) throw new BadRequestException(`${app.applicationNo} form fee is already paid`);
      const campaign = await m.getRepository(AdmissionCampaign).findOne({ where: { id: app.campaignId } });
      if (!campaign) throw new BadRequestException('Campaign not found');
      const amount = this.money(opts.amount ?? campaign.applicationFee, 'amount');
      if (new Decimal(amount).lte(0)) {
        throw new BadRequestException('No form fee configured for this campaign (application_fee is 0)');
      }
      const cashGl = await this.gl(m, opts.cashGlId ?? '11101');
      const formGl = await this.gl(m, '44102');
      const fund = await m.getRepository(Fund).findOne({ where: { fundCode: '01' } });
      if (!fund) throw new BadRequestException('Fund 01 (General) missing — run seed:accounting');
      const today = new Date().toISOString().slice(0, 10);
      const journal = await this.posting.postSystemJournal(m, {
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
      app.formFeePaid = true;
      await repo.save(app);
      return {
        applicationId: app.id,
        applicationNo: app.applicationNo,
        amount: new Decimal(amount).toFixed(2),
        journalId: journal.id,
        voucherNo: (journal as { voucherNo: string }).voucherNo,
      };
    });
  }

  /* ================= convert to admission draft ================= */

  /**
   * Pre-fill the Direct Admission Wizard from an approved applicant.
   * The wizard opens at Step 1 with the guardian phone queued (lookup →
   * auto-fill / new family) and Step 4 inputs pre-seeded from prev GPA +
   * quota. Admit still runs the full atomic flow — this only skips typing.
   */
  async convertToDraft(id: string) {
    const app = await this.applications.findOne({ where: { id }, relations: ['campaign'] });
    if (!app) throw new NotFoundException(`Application #${id} not found`);
    if (app.status === 'REJECTED') throw new BadRequestException('Rejected applications cannot convert');
    if (app.status === 'ADMITTED') throw new BadRequestException('Already admitted');
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

  private async gl(m: EntityManager, codeOrId: string) {
    const repo = m.getRepository(ChartOfAccount);
    const byId = await repo.findOne({ where: { id: codeOrId } });
    if (byId) return byId;
    const byCode = await repo.findOne({ where: { glCode: codeOrId } });
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
