import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { WaiverPresetRules, StudentWaivers } from '../generated/prisma/client';
import { WAIVER_TYPES } from '../database/entities/student-waiver.entity';

export interface WaiverSuggestion {
  ruleCode: string;
  ruleName: string;
  waiverType: string;
  admissionFeePct: string;
  tuitionFeePct: string;
  requiresZakatEligible: boolean;
  allowed: boolean;
  reason: string | null;
}

export interface WaiverPresetSeed {
  ruleCode: string;
  ruleName: string;
  institutionType?: string | null;
  minGpa?: string;
  maxGpa?: string;
  quotaTag?: string;
  residenceType?: string;
  waiverType: string;
  admissionFeePct: string;
  tuitionFeePct: string;
  requiresZakatEligible?: boolean;
  priority: number;
  remark?: string;
}

/** Single source of truth for the standard preset catalogue (service + seed script). */
export const DEFAULT_WAIVER_PRESETS: WaiverPresetSeed[] = [
  { ruleCode: 'ORPHAN_LILLAH', ruleName: 'Orphan / Lillah quota — 100% boarding (Fund 02)', quotaTag: 'ORPHAN_LILLAH', waiverType: 'LILLAH_ZAKAT_ORPHAN', admissionFeePct: '100.00', tuitionFeePct: '100.00', requiresZakatEligible: true, priority: 5, remark: 'Madrasah Lillah/Zakat boarding — zakat gate enforced' },
  { ruleCode: 'LILLAH_BOARDER', ruleName: 'Lillah boarder residence — 100% (Fund 02)', residenceType: 'MADRASAH_LILLAH_BOARDER', waiverType: 'LILLAH_ZAKAT_ORPHAN', admissionFeePct: '100.00', tuitionFeePct: '100.00', requiresZakatEligible: true, priority: 5, remark: 'Residence-driven Lillah rule — zakat gate enforced' },
  { ruleCode: 'GOLDEN_GPA5', ruleName: 'Golden GPA 5.00 — 100% admission + 50% tuition', minGpa: '5.00', maxGpa: '5.00', waiverType: 'MERIT', admissionFeePct: '100.00', tuitionFeePct: '50.00', priority: 10, remark: 'Class 11 / University merit (SSC GPA 5.00)' },
  { ruleCode: 'GPA4_PLUS', ruleName: 'GPA 4.00–4.99 — 50% admission + 25% tuition', minGpa: '4.00', maxGpa: '4.99', waiverType: 'MERIT', admissionFeePct: '50.00', tuitionFeePct: '25.00', priority: 20 },
  { ruleCode: 'FREEDOM_FIGHTER', ruleName: 'Freedom-fighter quota — 50% + 50%', quotaTag: 'FREEDOM_FIGHTER', waiverType: 'FREEDOM_FIGHTER', admissionFeePct: '50.00', tuitionFeePct: '50.00', priority: 30 },
  { ruleCode: 'SIBLING_DEFAULT', ruleName: 'Sibling quota — 25% admission + 20% tuition', quotaTag: 'SIBLING', waiverType: 'SIBLING_STAFF_AID', admissionFeePct: '25.00', tuitionFeePct: '20.00', priority: 30, remark: 'Mirrors Workflow 1 sibling suggestion' },
  { ruleCode: 'STAFF_CHILD', ruleName: 'Staff-child quota — 50% admission + 25% tuition', quotaTag: 'STAFF_CHILD', waiverType: 'SIBLING_STAFF_AID', admissionFeePct: '50.00', tuitionFeePct: '25.00', priority: 30 },
];

/**
 * Workflow 2 — Dynamic GPA-Based & Quota Waiver Calculator
 * (docs/STUDENT_ADMISSION_PLAN.md §4 Workflow 2).
 *
 * - Merit path: prev_gpa band → preset (e.g. GPA 5.00 → 100% admission +
 *   50% tuition). Institution-scoped rules only fire for that institution.
 * - Lillah path: quota ORPHAN_LILLAH / residence MADRASAH_LILLAH_BOARDER →
 *   Fund 02 gate: family.is_zakat_eligible_family must be true, else the
 *   suggestion is returned BLOCKED (never silently applied).
 */
@Injectable()
export class WaiverCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  /* ================= calculator ================= */

  async calculate(
    input: {
      prevGpa?: string;
      institutionType?: string;
      quotaTag?: string;
      residenceType?: string;
      familyId?: string;
    },
    /** Workflow 4 passes the onboarding transaction client for a consistent snapshot. */
    tx?: Prisma.TransactionClient,
  ): Promise<{ suggestions: WaiverSuggestion[] }> {
    const gpa = input.prevGpa !== undefined ? this.gpa(input.prevGpa, 'prevGpa') : null;
    const quota = this.norm(input.quotaTag);
    const residence = this.norm(input.residenceType);
    const institution = this.norm(input.institutionType);

    const db = tx ?? this.prisma;
    const actives = await db.waiverPresetRules.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { ruleCode: 'asc' }],
    });

    let family = null;
    if (input.familyId) {
      family = await db.familyProfiles.findUnique({ where: { id: input.familyId } });
      if (!family) throw new NotFoundException(`Family #${input.familyId} not found`);
    }

    const suggestions: WaiverSuggestion[] = [];
    for (const r of actives) {
      if (!this.matches(r, { gpa, quota, residence, institution })) continue;
      let allowed = true;
      let reason: string | null = null;
      if (r.requiresZakatEligible) {
        if (!family) {
          allowed = false;
          reason = 'Lillah/Zakat waiver needs a linked family (Step 1) to verify zakat eligibility.';
        } else if (!family.isZakatEligibleFamily) {
          allowed = false;
          reason = `Family ${family.familyCode} is not verified zakat-eligible — verify in Families Directory before Fund 02 (Lillah) boarding can be granted.`;
        }
      }
      suggestions.push({
        ruleCode: r.ruleCode,
        ruleName: r.ruleName,
        waiverType: r.waiverType,
        admissionFeePct: new Decimal(String(r.admissionFeePct)).toFixed(2),
        tuitionFeePct: new Decimal(String(r.tuitionFeePct)).toFixed(2),
        requiresZakatEligible: r.requiresZakatEligible,
        allowed,
        reason,
      });
    }
    return { suggestions };
  }

  /* ================= Lillah grant (post-admission) ================= */

  /**
   * Create the 100% LILLAH_ZAKAT_ORPHAN waiver for an admitted student.
   * Hard gate: family must be zakat-verified; posts to Fund 02 + 41904.
   * (Pre-admission selection is carried by the wizard into Phase 3; this
   * endpoint serves already-admitted students.)
   */
  async applyLillahWaiver(studentId: string, familyId: string, remark?: string): Promise<StudentWaivers> {
    const family = await this.prisma.familyProfiles.findUnique({ where: { id: familyId } });
    if (!family) throw new NotFoundException(`Family #${familyId} not found`);
    if (!family.isZakatEligibleFamily) {
      throw new BadRequestException(
        `Blocked: family ${family.familyCode} is not verified zakat-eligible (Fund 02 rule).`,
      );
    }
    const fund = await this.prisma.funds.findFirst({ where: { fundCode: '02' } });
    if (!fund) throw new BadRequestException('Fund 02 (Lillah/Zakat) missing — run seed:accounting');
    const contra = await this.prisma.chartOfAccounts.findFirst({ where: { glCode: '41904' } });
    if (!contra) throw new BadRequestException('Contra GL 41904 missing — run seed:accounting');
    return this.prisma.studentWaivers.create({
      data: {
        studentId,
        waiverType: 'LILLAH_ZAKAT_ORPHAN',
        percent: '100.00',
        fixedCapAmount: null,
        contraGlId: contra.id,
        fundId: fund.id,
        isActive: true,
        remark: remark ?? `Lillah boarding — family ${family.familyCode}`,
      },
    });
  }

  /* ================= preset CRUD + seed ================= */

  listRules(activeOnly = false): Promise<WaiverPresetRules[]> {
    return this.prisma.waiverPresetRules.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ priority: 'asc' }, { ruleCode: 'asc' }],
    });
  }

  async createRule(dto: {
    ruleCode: string; ruleName: string; institutionType?: string | null;
    minGpa?: string | null; maxGpa?: string | null; quotaTag?: string | null;
    residenceType?: string | null; waiverType: string; admissionFeePct: string;
    tuitionFeePct: string; requiresZakatEligible?: boolean; priority?: number;
    remark?: string | null;
  }): Promise<WaiverPresetRules> {
    const clash = await this.prisma.waiverPresetRules.findFirst({ where: { ruleCode: dto.ruleCode } });
    if (clash) throw new BadRequestException(`Preset "${dto.ruleCode}" already exists`);
    this.assertWaiverType(dto.waiverType);
    const min = dto.minGpa != null ? this.gpa(dto.minGpa, 'minGpa') : null;
    const max = dto.maxGpa != null ? this.gpa(dto.maxGpa, 'maxGpa') : null;
    if (min && max && min.gt(max)) throw new BadRequestException('minGpa cannot exceed maxGpa');
    return this.prisma.waiverPresetRules.create({
      data: {
        ruleCode: dto.ruleCode,
        ruleName: dto.ruleName,
        institutionType: dto.institutionType ?? null,
        minGpa: min?.toFixed(2) ?? null,
        maxGpa: max?.toFixed(2) ?? null,
        quotaTag: dto.quotaTag ?? null,
        residenceType: dto.residenceType ?? null,
        waiverType: dto.waiverType,
        admissionFeePct: this.pct(dto.admissionFeePct, 'admissionFeePct'),
        tuitionFeePct: this.pct(dto.tuitionFeePct, 'tuitionFeePct'),
        requiresZakatEligible: dto.requiresZakatEligible ?? false,
        priority: dto.priority ?? 100,
        isActive: true,
        remark: dto.remark ?? null,
      },
    });
  }

  async updateRule(id: string, dto: Record<string, unknown>): Promise<WaiverPresetRules> {
    const r = await this.prisma.waiverPresetRules.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`Preset #${id} not found`);
    if (dto.waiverType !== undefined) this.assertWaiverType(String(dto.waiverType));
    const data: Prisma.WaiverPresetRulesUpdateInput = {};
    if (dto.ruleName !== undefined) data.ruleName = String(dto.ruleName);
    if (dto.institutionType !== undefined) data.institutionType = (dto.institutionType as string) || null;
    if (dto.minGpa !== undefined) data.minGpa = dto.minGpa ? this.gpa(String(dto.minGpa), 'minGpa').toFixed(2) : null;
    if (dto.maxGpa !== undefined) data.maxGpa = dto.maxGpa ? this.gpa(String(dto.maxGpa), 'maxGpa').toFixed(2) : null;
    if (dto.quotaTag !== undefined) data.quotaTag = (dto.quotaTag as string) || null;
    if (dto.residenceType !== undefined) data.residenceType = (dto.residenceType as string) || null;
    if (dto.waiverType !== undefined) data.waiverType = String(dto.waiverType);
    if (dto.admissionFeePct !== undefined) data.admissionFeePct = this.pct(String(dto.admissionFeePct), 'admissionFeePct');
    if (dto.tuitionFeePct !== undefined) data.tuitionFeePct = this.pct(String(dto.tuitionFeePct), 'tuitionFeePct');
    if (dto.requiresZakatEligible !== undefined) data.requiresZakatEligible = Boolean(dto.requiresZakatEligible);
    if (dto.priority !== undefined) data.priority = Number(dto.priority);
    if (dto.isActive !== undefined) data.isActive = Boolean(dto.isActive);
    if (dto.remark !== undefined) data.remark = (dto.remark as string) || null;

    const nextMin = data.minGpa !== undefined ? (data.minGpa as string | null) : r.minGpa != null ? String(r.minGpa) : null;
    const nextMax = data.maxGpa !== undefined ? (data.maxGpa as string | null) : r.maxGpa != null ? String(r.maxGpa) : null;
    if (nextMin != null && nextMax != null && new Decimal(nextMin).gt(new Decimal(nextMax))) {
      throw new BadRequestException('minGpa cannot exceed maxGpa');
    }
    if (Object.keys(data).length === 0) return r;
    return this.prisma.waiverPresetRules.update({ where: { id }, data });
  }

  /** Idempotent seed of the plan's standard preset catalogue. */
  async seedDefaults(): Promise<WaiverPresetRules[]> {
    const out: WaiverPresetRules[] = [];
    for (const d of DEFAULT_WAIVER_PRESETS) {
      const existing = await this.prisma.waiverPresetRules.findFirst({ where: { ruleCode: d.ruleCode } });
      if (existing) {
        out.push(existing);
        continue;
      }
      out.push(await this.createRule({ ...d, institutionType: d.institutionType ?? null, remark: d.remark ?? null }));
    }
    return out;
  }

  /** Remove a preset rule permanently. */
  async deleteRule(id: string): Promise<{ id: string; deleted: boolean }> {
    const r = await this.prisma.waiverPresetRules.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`Preset #${id} not found`);
    await this.prisma.waiverPresetRules.delete({ where: { id } });
    return { id, deleted: true };
  }

  /* ================= internals ================= */

  private matches(
    r: WaiverPresetRules,
    by: { gpa: Decimal | null; quota: string | null; residence: string | null; institution: string | null },
  ): boolean {
    let cond = false;
    if (r.minGpa != null || r.maxGpa != null) {
      if (!by.gpa) return false;
      if (r.minGpa != null && by.gpa.lt(new Decimal(String(r.minGpa)))) return false;
      if (r.maxGpa != null && by.gpa.gt(new Decimal(String(r.maxGpa)))) return false;
      cond = true;
    }
    if (r.quotaTag) {
      if (!by.quota || by.quota !== r.quotaTag) return false;
      cond = true;
    }
    if (r.residenceType) {
      if (!by.residence || by.residence !== r.residenceType) return false;
      cond = true;
    }
    if (r.institutionType) {
      if (!by.institution || by.institution !== r.institutionType) return false;
      cond = true;
    }
    return cond; // a rule with zero conditions never fires
  }

  private norm(v?: string): string | null {
    const t = (v ?? '').trim().toUpperCase();
    return t === '' || t === 'NONE' || t === 'GENERAL' ? null : t;
  }

  private gpa(raw: string, tag: string): Decimal {
    let d: Decimal;
    try {
      d = new Decimal(String(raw));
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid decimal`);
    }
    if (!d.isFinite() || d.isNegative() || d.gt(5)) {
      throw new BadRequestException(`${tag} must be 0.00–5.00`);
    }
    return d;
  }

  private pct(raw: string, tag: string): string {
    let d: Decimal;
    try {
      d = new Decimal(String(raw));
    } catch {
      throw new BadRequestException(`${tag} "${raw}" is not a valid decimal`);
    }
    if (!d.isFinite() || d.isNegative() || d.gt(100)) {
      throw new BadRequestException(`${tag} must be 0–100`);
    }
    return d.toFixed(2);
  }

  private assertWaiverType(t: string): void {
    if (!(WAIVER_TYPES as string[]).includes(t)) {
      throw new BadRequestException(`waiverType must be one of ${WAIVER_TYPES.join(', ')}`);
    }
  }
}
