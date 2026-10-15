import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { WaiverPresetRule } from '../database/entities/waiver-preset-rule.entity';
import { FamilyProfile } from '../database/entities/family-profile.entity';
import { StudentWaiver, WAIVER_TYPES } from '../database/entities/student-waiver.entity';
import { Fund } from '../database/entities/fund.entity';
import { ChartOfAccount } from '../database/entities/chart-of-account.entity';

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
  constructor(
    @InjectRepository(WaiverPresetRule) private readonly rules: Repository<WaiverPresetRule>,
    @InjectRepository(FamilyProfile) private readonly families: Repository<FamilyProfile>,
    @InjectRepository(StudentWaiver) private readonly waivers: Repository<StudentWaiver>,
    @InjectRepository(Fund) private readonly funds: Repository<Fund>,
    @InjectRepository(ChartOfAccount) private readonly gls: Repository<ChartOfAccount>,
  ) {}

  /* ================= calculator ================= */

  async calculate(
    input: {
      prevGpa?: string;
      institutionType?: string;
      quotaTag?: string;
      residenceType?: string;
      familyId?: string;
    },
    /** Workflow 4 passes the onboarding transaction manager for a consistent snapshot. */
    manager?: EntityManager,
  ): Promise<{ suggestions: WaiverSuggestion[] }> {
    const gpa = input.prevGpa !== undefined ? this.gpa(input.prevGpa, 'prevGpa') : null;
    const quota = this.norm(input.quotaTag);
    const residence = this.norm(input.residenceType);
    const institution = this.norm(input.institutionType);

    const rulesRepo = manager?.getRepository(WaiverPresetRule) ?? this.rules;
    const familiesRepo = manager?.getRepository(FamilyProfile) ?? this.families;
    const actives = await rulesRepo.find({
      where: { isActive: true },
      order: { priority: 'ASC', ruleCode: 'ASC' },
    });

    let family: FamilyProfile | null = null;
    if (input.familyId) {
      family = await familiesRepo.findOne({ where: { id: input.familyId } });
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
        admissionFeePct: r.admissionFeePct,
        tuitionFeePct: r.tuitionFeePct,
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
  async applyLillahWaiver(studentId: string, familyId: string, remark?: string): Promise<StudentWaiver> {
    const family = await this.families.findOne({ where: { id: familyId } });
    if (!family) throw new NotFoundException(`Family #${familyId} not found`);
    if (!family.isZakatEligibleFamily) {
      throw new BadRequestException(
        `Blocked: family ${family.familyCode} is not verified zakat-eligible (Fund 02 rule).`,
      );
    }
    const fund = await this.funds.findOne({ where: { fundCode: '02' } });
    if (!fund) throw new BadRequestException('Fund 02 (Lillah/Zakat) missing — run seed:accounting');
    const contra = await this.gls.findOne({ where: { glCode: '41904' } });
    if (!contra) throw new BadRequestException('Contra GL 41904 missing — run seed:accounting');
    return this.waivers.save(
      this.waivers.create({
        studentId,
        waiverType: 'LILLAH_ZAKAT_ORPHAN',
        percent: '100.00',
        fixedCapAmount: null,
        contraGlId: contra.id,
        fundId: fund.id,
        isActive: true,
        remark: remark ?? `Lillah boarding — family ${family.familyCode}`,
      }),
    );
  }

  /* ================= preset CRUD + seed ================= */

  listRules(activeOnly = false): Promise<WaiverPresetRule[]> {
    return this.rules.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: { priority: 'ASC', ruleCode: 'ASC' },
    });
  }

  async createRule(dto: {
    ruleCode: string; ruleName: string; institutionType?: string | null;
    minGpa?: string | null; maxGpa?: string | null; quotaTag?: string | null;
    residenceType?: string | null; waiverType: string; admissionFeePct: string;
    tuitionFeePct: string; requiresZakatEligible?: boolean; priority?: number;
    remark?: string | null;
  }): Promise<WaiverPresetRule> {
    const clash = await this.rules.findOne({ where: { ruleCode: dto.ruleCode } });
    if (clash) throw new BadRequestException(`Preset "${dto.ruleCode}" already exists`);
    this.assertWaiverType(dto.waiverType);
    const min = dto.minGpa != null ? this.gpa(dto.minGpa, 'minGpa') : null;
    const max = dto.maxGpa != null ? this.gpa(dto.maxGpa, 'maxGpa') : null;
    if (min && max && min.gt(max)) throw new BadRequestException('minGpa cannot exceed maxGpa');
    return this.rules.save(
      this.rules.create({
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
      }),
    );
  }

  async updateRule(id: string, dto: Record<string, unknown>): Promise<WaiverPresetRule> {
    const r = await this.rules.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Preset #${id} not found`);
    if (dto.waiverType !== undefined) this.assertWaiverType(String(dto.waiverType));
    const patch: Partial<WaiverPresetRule> = {};
    if (dto.ruleName !== undefined) patch.ruleName = String(dto.ruleName);
    if (dto.institutionType !== undefined) patch.institutionType = (dto.institutionType as string) || null;
    if (dto.minGpa !== undefined) patch.minGpa = dto.minGpa ? this.gpa(String(dto.minGpa), 'minGpa').toFixed(2) : null;
    if (dto.maxGpa !== undefined) patch.maxGpa = dto.maxGpa ? this.gpa(String(dto.maxGpa), 'maxGpa').toFixed(2) : null;
    if (dto.quotaTag !== undefined) patch.quotaTag = (dto.quotaTag as string) || null;
    if (dto.residenceType !== undefined) patch.residenceType = (dto.residenceType as string) || null;
    if (dto.waiverType !== undefined) patch.waiverType = String(dto.waiverType);
    if (dto.admissionFeePct !== undefined) patch.admissionFeePct = this.pct(String(dto.admissionFeePct), 'admissionFeePct');
    if (dto.tuitionFeePct !== undefined) patch.tuitionFeePct = this.pct(String(dto.tuitionFeePct), 'tuitionFeePct');
    if (dto.requiresZakatEligible !== undefined) patch.requiresZakatEligible = Boolean(dto.requiresZakatEligible);
    if (dto.priority !== undefined) patch.priority = Number(dto.priority);
    if (dto.isActive !== undefined) patch.isActive = Boolean(dto.isActive);
    if (dto.remark !== undefined) patch.remark = (dto.remark as string) || null;
    Object.assign(r, patch);
    if (r.minGpa != null && r.maxGpa != null && new Decimal(r.minGpa).gt(new Decimal(r.maxGpa))) {
      throw new BadRequestException('minGpa cannot exceed maxGpa');
    }
    return this.rules.save(r);
  }

  /** Idempotent seed of the plan's standard preset catalogue. */
  async seedDefaults(): Promise<WaiverPresetRule[]> {
    const out: WaiverPresetRule[] = [];
    for (const d of DEFAULT_WAIVER_PRESETS) {
      const existing = await this.rules.findOne({ where: { ruleCode: d.ruleCode } });
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
    const r = await this.rules.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Preset #${id} not found`);
    await this.rules.remove(r);
    return { id, deleted: true };
  }

  /* ================= internals ================= */

  private matches(
    r: WaiverPresetRule,
    by: { gpa: Decimal | null; quota: string | null; residence: string | null; institution: string | null },
  ): boolean {
    let cond = false;
    if (r.minGpa != null || r.maxGpa != null) {
      if (!by.gpa) return false;
      if (r.minGpa != null && by.gpa.lt(new Decimal(r.minGpa))) return false;
      if (r.maxGpa != null && by.gpa.gt(new Decimal(r.maxGpa))) return false;
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
