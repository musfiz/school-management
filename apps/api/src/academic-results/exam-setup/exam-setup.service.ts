import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ExamTerms } from '../../generated/prisma/client';
import { UserRole } from '../../database/entities/user-role.enum';
import { validateGradeRanges } from '../common/grade-lookup.util';
import {
  COMPONENT_CODES,
  CT_AGGREGATION_MODES,
  MARK_ROUNDING_MODES,
  SOURCE_TYPES,
  SCALE_TYPES,
  TERM_STATUSES,
  assertComponentSetSumsToFullMarks,
  assertConvertedFormula,
  assertOneOf,
  assertSourceRule,
  assertWeightsSumTo100,
  convertMaxMarks,
  dec,
  isControllerOnlyTransition,
  isTransitionAllowed,
  sumConvertedMax,
} from './validators/component-sum.validator';
import { ENGINE_BEHAVIORS, isEngineBehavior, resolveEngineBehavior } from '../common/engine-behavior.util';
import type {
  ComponentItemDto,
  CreateExamTermDto,
  CreateGradingScaleDto,
  SetTermStatusDto,
  SetTermWeightsDto,
  TermScopeQueryDto,
  UpdateExamTermDto,
  UpdateGradingScaleDto,
  UpsertComponentDto,
  BulkCopyComponentsDto,
} from './exam-setup.dto';

/**
 * Result Engine §PHASE 3 — exam term, CT rules & component distribution.
 *
 * Owns `exam_terms` (+ its CUMULATIVE_ANNUAL `exam_term_weights`) and
 * `exam_subject_components`, enforces the CC-17 component-sum gate and the
 * CC-18 state machine, and reuses the seeded `grading_scales` read-only.
 */
@Injectable()
export class ExamSetupService {
  constructor(private readonly prisma: PrismaService) {}

  /* ================= grading scales (read-only) ================= */

  listGradingScales() {
    return this.prisma.gradingScales.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /** AD-4 — the seeded attendance-percentage → awarded-marks ladder. */
  listAttendanceSlabs() {
    return this.prisma.attendanceMarkSlabs.findMany({
      orderBy: { minAttendancePct: 'desc' },
    });
  }

  async getGradingScale(id: string) {
    const scale = await this.prisma.gradingScales.findUnique({
      where: { id },
      include: { gradingScaleRanges: { orderBy: { minPercentage: 'desc' } } },
    });
    if (!scale) throw new NotFoundException(`Grading scale #${id} not found`);
    return scale;
  }

  /**
   * Create a grading scale from the configurator (Phase 7 task 1).
   *
   * Ranges are validated by the same CC-02 helper the calculation engine uses,
   * plus a contiguity/coverage check so a percentage can never fall through a
   * gap (T5) and the ladder always reaches 100.
   */
  async createGradingScale(dto: CreateGradingScaleDto) {
    assertOneOf(dto.scaleType, SCALE_TYPES, 'scaleType');
    const ranges = this.normaliseRanges(dto.ranges);
    return this.prisma.gradingScales.create({
      data: {
        name: dto.name,
        scaleType: dto.scaleType,
        maxPoint: dec(dto.maxPoint, 'maxPoint').toFixed(2),
        minPassPoint: dec(dto.minPassPoint, 'minPassPoint').toFixed(2),
        minPassPercentage: dec(dto.minPassPercentage ?? '33', 'minPassPercentage').toFixed(2),
        fourthSubjectDeduction: dec(dto.fourthSubjectDeduction ?? '2', 'fourthSubjectDeduction').toFixed(2),
        gradingScaleRanges: { create: ranges },
      },
      include: { gradingScaleRanges: { orderBy: { minPercentage: 'desc' } } },
    });
  }

  async updateGradingScale(id: string, dto: UpdateGradingScaleDto) {
    const existing = await this.getGradingScale(id);
    if (dto.scaleType) assertOneOf(dto.scaleType, SCALE_TYPES, 'scaleType');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.scaleType !== undefined) data.scaleType = dto.scaleType;
    if (dto.maxPoint !== undefined) data.maxPoint = dec(dto.maxPoint, 'maxPoint').toFixed(2);
    if (dto.minPassPoint !== undefined) data.minPassPoint = dec(dto.minPassPoint, 'minPassPoint').toFixed(2);
    if (dto.minPassPercentage !== undefined) data.minPassPercentage = dec(dto.minPassPercentage, 'minPassPercentage').toFixed(2);
    if (dto.fourthSubjectDeduction !== undefined) {
      data.fourthSubjectDeduction = dec(dto.fourthSubjectDeduction, 'fourthSubjectDeduction').toFixed(2);
    }
    if (dto.isActive !== undefined) data.isActive = Boolean(dto.isActive);

    // In-place range replacement — a scale must never be left partially edited.
    if (dto.ranges) {
      const ranges = this.normaliseRanges(dto.ranges);
      await this.prisma.$transaction(async (tx) => {
        await tx.gradingScaleRanges.deleteMany({ where: { gradingScaleId: id } });
        await tx.gradingScaleRanges.createMany({
          data: ranges.map((range) => ({ ...range, gradingScaleId: id })),
        });
        if (Object.keys(data).length) {
          await tx.gradingScales.update({ where: { id }, data });
        }
      });
      return this.getGradingScale(id);
    }

    if (Object.keys(data).length) {
      await this.prisma.gradingScales.update({ where: { id }, data });
    }
    return this.getGradingScale(existing.id);
  }

  /** Delete a scale — blocked while any exam term still references it. */
  async deleteGradingScale(id: string) {
    const scale = await this.getGradingScale(id);
    const used = await this.prisma.examTerms.count({ where: { gradingScaleId: id } });
    if (used) {
      throw new BadRequestException(
        `"${scale.name}" is used by ${used} exam term(s) — deactivate it instead of deleting`,
      );
    }
    await this.prisma.gradingScales.delete({ where: { id } });
    return { deleted: true as const };
  }

  /** Validate + normalise range rows into `grading_scale_ranges` shapes. */
  private normaliseRanges(ranges: CreateGradingScaleDto['ranges']) {
    const numeric = ranges.map((range) => ({
      minPercentage: dec(range.minPercentage, 'minPercentage'),
      maxPercentage: dec(range.maxPercentage, 'maxPercentage'),
      letterGrade: range.letterGrade,
      gradePoint: dec(range.gradePoint, 'gradePoint'),
      descriptiveRemark: range.descriptiveRemark ?? null,
    }));

    for (const range of numeric) {
      if (range.maxPercentage.lte(range.minPercentage)) {
        throw new BadRequestException(
          `Range ${range.minPercentage}–${range.maxPercentage}: maxPercentage must exceed minPercentage`,
        );
      }
      if (range.maxPercentage.gt(100) || range.minPercentage.lt(0)) {
        throw new BadRequestException('Range percentages must sit between 0 and 100');
      }
    }

    validateGradeRanges(
      numeric.map((range) => ({
        minPercentage: range.minPercentage.toFixed(2),
        maxPercentage: range.maxPercentage.toFixed(2),
        letterGrade: range.letterGrade,
        gradePoint: range.gradePoint.toFixed(2),
        descriptiveRemark: range.descriptiveRemark,
      })),
      'grading scale',
    );

    const sorted = [...numeric].sort((a, b) => a.minPercentage.comparedTo(b.minPercentage));
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].minPercentage.gt(sorted[i - 1].maxPercentage.plus('0.01'))) {
        throw new BadRequestException(
          `Gap between ${sorted[i - 1].maxPercentage} and ${sorted[i].minPercentage} — a percentage would match no grade`,
        );
      }
    }
    if (sorted[sorted.length - 1].maxPercentage.lt(100)) {
      throw new BadRequestException(
        `The top range must reach 100 (currently ${sorted[sorted.length - 1].maxPercentage})`,
      );
    }

    return numeric.map((range) => ({
      minPercentage: range.minPercentage.toFixed(2),
      maxPercentage: range.maxPercentage.toFixed(2),
      letterGrade: range.letterGrade,
      gradePoint: range.gradePoint.toFixed(2),
      descriptiveRemark: range.descriptiveRemark,
    }));
  }

  /* ================= exam terms ================= */

  listTerms(dto: TermScopeQueryDto) {
    return this.prisma.examTerms.findMany({
      where: {
        academicSessionId: dto.academicSessionId,
        classOrDeptId: dto.classOrDeptId,
        ...(dto.termType ? { termType: dto.termType } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      orderBy: [{ sequenceNo: 'asc' }, { termName: 'asc' }],
    });
  }

  async getTermDetail(id: string) {
    const term = await this.getTerm(id);
    const [gradingScale, componentCount, weightCount, childCount] = await Promise.all([
      this.prisma.gradingScales.findUnique({ where: { id: term.gradingScaleId } }),
      this.prisma.examSubjectComponents.count({ where: { examTermId: id } }),
      this.prisma.examTermWeights.count({ where: { parentExamTermId: id } }),
      this.prisma.examTerms.count({ where: { parentTerminalExamId: id } }),
    ]);
    return { ...term, gradingScale, componentCount, weightCount, childCount };
  }

  async createTerm(dto: CreateExamTermDto): Promise<ExamTerms> {
    await this.assertTermTypeUsable(dto.termType);
    const ctAggregationMode = dto.ctAggregationMode ?? 'BEST_N_AVERAGE';
    assertOneOf(ctAggregationMode, CT_AGGREGATION_MODES, 'ctAggregationMode');
    const markRoundingMode = dto.markRoundingMode ?? 'HALF_UP_INTEGER';
    assertOneOf(markRoundingMode, MARK_ROUNDING_MODES, 'markRoundingMode');

    const scale = await this.prisma.gradingScales.findUnique({ where: { id: dto.gradingScaleId } });
    if (!scale) throw new NotFoundException(`Grading scale #${dto.gradingScaleId} not found`);

    await this.assertParentTerminal(dto.parentTerminalExamId ?? null, dto.academicSessionId, dto.classOrDeptId, null);

    return this.prisma.examTerms.create({
      data: {
        academicSessionId: dto.academicSessionId,
        classOrDeptId: dto.classOrDeptId,
        gradingScaleId: dto.gradingScaleId,
        termName: dto.termName,
        termType: dto.termType,
        parentTerminalExamId: dto.parentTerminalExamId ?? null,
        sequenceNo: dto.sequenceNo ?? 1,
        ctAggregationMode,
        ctBestCount: dto.ctBestCount ?? 2,
        annualWeightPct: dec(dto.annualWeightPct ?? '100', 'annualWeightPct').toFixed(2),
        markRoundingMode,
        minCoursesToPromote: dto.minCoursesToPromote ?? 0,
        minCgpaToPromote: dec(dto.minCgpaToPromote ?? '0', 'minCgpaToPromote').toFixed(2),
        status: 'SETUP',
      },
    });
  }

  async updateTerm(id: string, dto: UpdateExamTermDto): Promise<ExamTerms> {
    const term = await this.getTerm(id);
    this.requireStatus(term, 'SETUP', 'Term metadata can only be changed while the term is in SETUP');

    if (dto.gradingScaleId) {
      const scale = await this.prisma.gradingScales.findUnique({ where: { id: dto.gradingScaleId } });
      if (!scale) throw new NotFoundException(`Grading scale #${dto.gradingScaleId} not found`);
    }
    if (dto.ctAggregationMode) assertOneOf(dto.ctAggregationMode, CT_AGGREGATION_MODES, 'ctAggregationMode');
    if (dto.markRoundingMode) assertOneOf(dto.markRoundingMode, MARK_ROUNDING_MODES, 'markRoundingMode');
    if (dto.parentTerminalExamId !== undefined) {
      await this.assertParentTerminal(dto.parentTerminalExamId, term.academicSessionId, term.classOrDeptId, term.id);
    }

    return this.prisma.examTerms.update({
      where: { id },
      data: {
        gradingScaleId: dto.gradingScaleId ?? undefined,
        termName: dto.termName ?? undefined,
        parentTerminalExamId: dto.parentTerminalExamId === undefined ? undefined : dto.parentTerminalExamId,
        sequenceNo: dto.sequenceNo ?? undefined,
        ctAggregationMode: dto.ctAggregationMode ?? undefined,
        ctBestCount: dto.ctBestCount ?? undefined,
        annualWeightPct: dto.annualWeightPct === undefined ? undefined : dec(dto.annualWeightPct, 'annualWeightPct').toFixed(2),
        markRoundingMode: dto.markRoundingMode ?? undefined,
        minCoursesToPromote: dto.minCoursesToPromote ?? undefined,
        minCgpaToPromote: dto.minCgpaToPromote === undefined ? undefined : dec(dto.minCgpaToPromote, 'minCgpaToPromote').toFixed(2),
      },
    });
  }

  async deleteTerm(id: string): Promise<{ deleted: true }> {
    const term = await this.getTerm(id);
    this.requireStatus(term, 'SETUP', 'A term can only be deleted while in SETUP');

    const [children, weightsAsParent, weightsAsChild, components, marks, summaries, jobs] = await Promise.all([
      this.prisma.examTerms.count({ where: { parentTerminalExamId: id } }),
      this.prisma.examTermWeights.count({ where: { parentExamTermId: id } }),
      this.prisma.examTermWeights.count({ where: { childExamTermId: id } }),
      this.prisma.examSubjectComponents.count({ where: { examTermId: id } }),
      this.prisma.studentComponentMarks.count({ where: { examTermId: id } }),
      this.prisma.studentAttendanceSummaries.count({ where: { examTermId: id } }),
      this.prisma.resultGenerationJobs.count({ where: { examTermId: id } }),
    ]);
    const blockers = { children, weightsAsParent, weightsAsChild, components, marks, summaries, jobs };
    const offending = Object.entries(blockers).filter(([, n]) => n > 0);
    if (offending.length) {
      throw new BadRequestException(
        `Term cannot be deleted — still referenced by: ${offending.map(([k, n]) => `${k}=${n}`).join(', ')}`,
      );
    }
    await this.prisma.examTerms.delete({ where: { id } });
    return { deleted: true as const };
  }

  /**
   * CC-18 state machine. `MARKS_ENTRY` requires every configured subject to pass
   * the CC-17 component-sum gate; `MARKS_ENTRY → SETUP` is blocked once marks
   * exist; a `PUBLISHED → MARKS_ENTRY` reopen requires EXAM_CONTROLLER and is
   * written to the system audit log.
   */
  async setTermStatus(
    id: string,
    dto: SetTermStatusDto,
    actor: { id?: string | null; role?: string | null },
    ip?: string | null,
  ): Promise<ExamTerms> {
    const term = await this.getTerm(id);
    assertOneOf(dto.status, TERM_STATUSES, 'status');
    const from = term.status;
    const to = dto.status;
    if (from === to) return term;

    if (!isTransitionAllowed(from, to)) {
      throw new BadRequestException(`Illegal exam-term transition ${from} → ${to}`);
    }
    if (isControllerOnlyTransition(from, to) && actor.role !== UserRole.EXAM_CONTROLLER) {
      throw new ForbiddenException(`Reopening a published term (${from} → ${to}) requires the EXAM_CONTROLLER role`);
    }
    if (to === 'MARKS_ENTRY') {
      await this.assertTermComponentsValid(id);
    }
    if (from === 'MARKS_ENTRY' && to === 'SETUP') {
      const marks = await this.prisma.studentComponentMarks.count({ where: { examTermId: id } });
      if (marks > 0) throw new BadRequestException(`Cannot return to SETUP — ${marks} component mark(s) already entered`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.examTerms.update({ where: { id }, data: { status: to } });
      if (isControllerOnlyTransition(from, to)) {
        await tx.accountingAuditLogs.create({
          data: {
            eventType: 'RESULT_TERM_REOPEN',
            entityType: 'exam_term',
            entityId: id,
            entityReference: term.termName,
            actorId: actor.id ?? null,
            action: 'REOPEN',
            details: `${from} → ${to}${dto.reason ? `: ${dto.reason}` : ''}`,
            ipAddress: ip ?? null,
          },
        });
      }
      return updated;
    });
  }

  /* ================= term weights (CUMULATIVE_ANNUAL) ================= */

  async getTermWeights(termId: string) {
    const term = await this.getTerm(termId);
    const weights = await this.prisma.examTermWeights.findMany({
      where: { parentExamTermId: termId },
      include: { childExamTerm: true },
      orderBy: { weightPct: 'desc' },
    });
    return {
      parentExamTermId: termId,
      termType: term.termType,
      weights: weights.map((w) => ({
        id: w.id,
        childExamTermId: w.childExamTermId,
        weightPct: String(w.weightPct),
        child: w.childExamTerm
          ? { termName: w.childExamTerm.termName, termType: w.childExamTerm.termType, sequenceNo: w.childExamTerm.sequenceNo }
          : null,
      })),
    };
  }

  async setTermWeights(termId: string, dto: SetTermWeightsDto) {
    const term = await this.getTerm(termId);
    this.requireStatus(term, 'SETUP', 'Term weights can only be changed while the term is in SETUP');
    if (term.termType !== 'CUMULATIVE_ANNUAL') {
      throw new BadRequestException('Term weights only apply to CUMULATIVE_ANNUAL terms');
    }

    const childIds = dto.weights.map((w) => w.childExamTermId);
    if (new Set(childIds).size !== childIds.length) {
      throw new BadRequestException('Duplicate childExamTermId in weights');
    }
    if (childIds.includes(termId)) throw new BadRequestException('A term cannot weight itself');
    assertWeightsSumTo100(dto.weights, 'annual weights');

    const children = await this.prisma.examTerms.findMany({ where: { id: { in: childIds } } });
    if (children.length !== childIds.length) throw new NotFoundException('One or more child terms were not found');
    for (const child of children) {
      if (child.termType !== 'TERMINAL') {
        throw new BadRequestException(`Child term "${child.termName}" must be a TERMINAL term`);
      }
      if (child.academicSessionId !== term.academicSessionId || child.classOrDeptId !== term.classOrDeptId) {
        throw new BadRequestException(`Child term "${child.termName}" must belong to the same session and class`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.examTermWeights.deleteMany({ where: { parentExamTermId: termId } });
      await tx.examTermWeights.createMany({
        data: dto.weights.map((w) => ({
          parentExamTermId: termId,
          childExamTermId: w.childExamTermId,
          weightPct: dec(w.weightPct, 'weightPct').toFixed(2),
        })),
      });
    });

    return this.getTermWeights(termId);
  }

  /* ================= subject components ================= */

  listComponents(termId: string, syllabusSubjectId?: string) {
    return this.prisma.examSubjectComponents.findMany({
      where: { examTermId: termId, ...(syllabusSubjectId ? { syllabusSubjectId } : {}) },
      orderBy: [{ syllabusSubjectId: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  /** CC-17 report: per-subject `Σ converted_max_marks` vs the syllabus `full_marks`. */
  async componentReport(termId: string) {
    const term = await this.getTerm(termId);
    const [rows, subjects] = await Promise.all([
      this.prisma.examSubjectComponents.findMany({
        where: { examTermId: termId },
        orderBy: [{ syllabusSubjectId: 'asc' }, { displayOrder: 'asc' }],
      }),
      this.prisma.classSyllabusSubjects.findMany({
        where: { academicSessionId: term.academicSessionId, classOrDeptId: term.classOrDeptId },
        include: { academicSubjects: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    const report = subjects.map((subject) => {
      const components = rows.filter((r) => r.syllabusSubjectId === subject.id);
      const issues: string[] = [];
      for (const c of components) {
        try {
          assertConvertedFormula(c, c.componentCode);
        } catch (err) {
          issues.push(err instanceof Error ? err.message : String(err));
        }
        if (c.sourceType === 'AUTO_FROM_SUB_EXAMS' && !c.sourceComponentCode) {
          issues.push(`${c.componentCode}: source_component_code is required for AUTO_FROM_SUB_EXAMS`);
        }
      }
      const sum = sumConvertedMax(components);
      const configured = components.length > 0;
      if (configured && !dec(sum, 'sum').equals(dec(subject.fullMarks, 'fullMarks'))) {
        issues.push(
          `Σ converted_max_marks (${sum}) ≠ full_marks (${dec(subject.fullMarks).toFixed(2)})`,
        );
      }
      return {
        syllabusSubjectId: subject.id,
        subjectCode: subject.academicSubjects?.subjectCode ?? null,
        subjectName: subject.academicSubjects?.subjectName ?? null,
        fullMarks: String(subject.fullMarks),
        convertedMaxSum: sum,
        configured,
        valid: issues.length === 0,
        issues,
        components,
      };
    });

    return {
      termId,
      valid: report.every((r) => !r.configured || r.valid),
      subjects: report,
    };
  }

  /** Throws when any configured subject fails CC-17 — the gate for entering MARKS_ENTRY. */
  async assertTermComponentsValid(termId: string): Promise<void> {
    const report = await this.componentReport(termId);
    const offenders = report.subjects.filter((s) => s.configured && !s.valid);
    if (offenders.length) {
      throw new BadRequestException(
        `Component sets invalid for ${offenders.length} subject(s): ` +
          offenders.map((s) => `${s.subjectCode ?? s.syllabusSubjectId} (${s.issues.join('; ')})`).join(' | '),
      );
    }
  }

  async upsertComponent(termId: string, dto: UpsertComponentDto) {
    const term = await this.getTerm(termId);
    this.requireStatus(term, 'SETUP', 'Components can only be configured while the term is in SETUP');
    await this.getTermSubject(term, dto.syllabusSubjectId);

    const values = this.buildComponentValues(dto);
    const existing = await this.prisma.examSubjectComponents.findFirst({
      where: { examTermId: termId, syllabusSubjectId: dto.syllabusSubjectId, componentCode: values.componentCode },
    });
    if (existing) {
      return this.prisma.examSubjectComponents.update({ where: { id: existing.id }, data: values });
    }
    return this.prisma.examSubjectComponents.create({
      data: { examTermId: termId, syllabusSubjectId: dto.syllabusSubjectId, ...values },
    });
  }

  /** Replaces one subject's whole component set — the CC-17-gated editor. */
  async replaceSubjectComponents(termId: string, syllabusSubjectId: string, components: ComponentItemDto[]) {
    const term = await this.getTerm(termId);
    this.requireStatus(term, 'SETUP', 'Components can only be configured while the term is in SETUP');
    const subject = await this.getTermSubject(term, syllabusSubjectId);

    const built = components.map((c) => this.buildComponentValues(c));
    const codes = built.map((b) => b.componentCode);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Duplicate componentCode in the submitted set');
    }
    assertComponentSetSumsToFullMarks(
      built,
      subject.fullMarks,
      `subject ${subject.academicSubjects?.subjectCode ?? syllabusSubjectId}`,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.examSubjectComponents.deleteMany({ where: { examTermId: termId, syllabusSubjectId } });
      await tx.examSubjectComponents.createMany({
        data: built.map((b) => ({ examTermId: termId, syllabusSubjectId, ...b })),
      });
    });

    const saved = await this.listComponents(termId, syllabusSubjectId);
    return { saved: saved.length, fullMarks: String(subject.fullMarks), convertedMaxSum: sumConvertedMax(built), components: saved };
  }

  async deleteComponent(termId: string, componentId: string): Promise<{ deleted: true }> {
    const term = await this.getTerm(termId);
    this.requireStatus(term, 'SETUP', 'Components can only be changed while the term is in SETUP');
    const component = await this.prisma.examSubjectComponents.findUnique({ where: { id: componentId } });
    if (!component || component.examTermId !== termId) {
      throw new NotFoundException(`Component #${componentId} not found on term #${termId}`);
    }
    await this.prisma.examSubjectComponents.delete({ where: { id: componentId } });
    return { deleted: true as const };
  }

  /** Copies one subject's component set onto other subjects of the same term. */
  async bulkCopyComponents(termId: string, dto: BulkCopyComponentsDto) {
    const term = await this.getTerm(termId);
    this.requireStatus(term, 'SETUP', 'Components can only be configured while the term is in SETUP');

    const source = await this.prisma.examSubjectComponents.findMany({
      where: { examTermId: termId, syllabusSubjectId: dto.sourceSyllabusSubjectId },
      orderBy: { displayOrder: 'asc' },
    });
    if (!source.length) throw new BadRequestException('Source subject has no components to copy');

    const targets = [...new Set(dto.targetSyllabusSubjectIds)].filter((t) => t !== dto.sourceSyllabusSubjectId);
    if (!targets.length) throw new BadRequestException('Provide at least one target subject different from the source');

    const plans: { targetId: string; rows: ReturnType<ExamSetupService['buildComponentValues']>[] }[] = [];
    for (const targetId of targets) {
      const subject = await this.getTermSubject(term, targetId);
      const built = source.map((s) =>
        this.buildComponentValues({
          componentCode: s.componentCode,
          componentName: s.componentName,
          sourceType: s.sourceType,
          sourceComponentCode: s.sourceComponentCode,
          maxRawMarks: String(s.maxRawMarks),
          conversionWeightPct: String(s.conversionWeightPct),
          minPassMarks: String(s.minPassMarks),
          displayOrder: s.displayOrder,
        }),
      );
      assertComponentSetSumsToFullMarks(
        built,
        subject.fullMarks,
        `target subject ${subject.academicSubjects?.subjectCode ?? targetId}`,
      );
      plans.push({ targetId, rows: built });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const plan of plans) {
        await tx.examSubjectComponents.deleteMany({ where: { examTermId: termId, syllabusSubjectId: plan.targetId } });
        await tx.examSubjectComponents.createMany({
          data: plan.rows.map((r) => ({ examTermId: termId, syllabusSubjectId: plan.targetId, ...r })),
        });
      }
    });

    return { termId, sourceSyllabusSubjectId: dto.sourceSyllabusSubjectId, copiedTo: plans.map((p) => p.targetId) };
  }

  /* ================= internals ================= */

  private async getTerm(id: string): Promise<ExamTerms> {
    const term = await this.prisma.examTerms.findUnique({ where: { id } });
    if (!term) throw new NotFoundException(`Exam term #${id} not found`);
    return term;
  }

  private requireStatus(term: ExamTerms, status: string, message: string): void {
    if (term.status !== status) throw new BadRequestException(`${message} (current status: ${term.status})`);
  }

  private async assertTermTypeUsable(code: string): Promise<string> {
    if (!code) throw new BadRequestException('termType is required');
    const upper = code.trim().toUpperCase();
    if (isEngineBehavior(upper)) return upper;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT id, code, engine_behavior AS engineBehavior, is_active AS isActive FROM `exam_term_types` WHERE `code` = ? LIMIT 1',
      upper,
    );
    const master = rows && rows.length ? rows[0] : null;
    if (!master) {
      throw new BadRequestException(`Unknown term type "${code}" — please add it under Term Types first`);
    }
    if (!Number(master.isActive)) {
      throw new BadRequestException(`Term type "${code}" is inactive`);
    }
    return String(master.engineBehavior);
  }

  private async assertParentTerminal(
    parentId: string | null | undefined,
    academicSessionId: string,
    classOrDeptId: string,
    selfId: string | null,
  ): Promise<void> {
    if (!parentId) return;
    if (selfId && parentId === selfId) throw new BadRequestException('A term cannot be its own parent');
    const parent = await this.prisma.examTerms.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException(`Parent term #${parentId} not found`);
    const parentMasterRows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT id, code, engine_behavior AS engineBehavior, is_active AS isActive FROM `exam_term_types` WHERE `code` = ? LIMIT 1',
      parent.termType,
    );
    const parentMaster = parentMasterRows && parentMasterRows.length ? parentMasterRows[0] : null;
    const behavior = resolveEngineBehavior(parent.termType, parentMaster);
    if (behavior !== 'TERMINAL') {
      throw new BadRequestException('parentTerminalExamId must reference a TERMINAL term');
    }
    if (parent.academicSessionId !== academicSessionId || parent.classOrDeptId !== classOrDeptId) {
      throw new BadRequestException('Parent term must belong to the same session and class');
    }
  }

  private async getTermSubject(term: ExamTerms, syllabusSubjectId: string) {
    const subject = await this.prisma.classSyllabusSubjects.findFirst({
      where: {
        id: syllabusSubjectId,
        academicSessionId: term.academicSessionId,
        classOrDeptId: term.classOrDeptId,
      },
      include: { academicSubjects: true },
    });
    if (!subject) {
      throw new BadRequestException(
        `Syllabus subject #${syllabusSubjectId} does not belong to this term's session and class`,
      );
    }
    return subject;
  }

  private buildComponentValues(dto: ComponentItemDto) {
    assertOneOf(dto.componentCode, COMPONENT_CODES, 'componentCode');
    const sourceType = dto.sourceType ?? 'MANUAL_ENTRY';
    assertOneOf(sourceType, SOURCE_TYPES, 'sourceType');
    const sourceComponentCode = dto.sourceComponentCode ?? null;
    assertSourceRule(sourceType, sourceComponentCode, `component ${dto.componentCode}`);

    const conversionWeightPct = dec(dto.conversionWeightPct ?? '100', 'conversionWeightPct').toFixed(2);
    const convertedMaxMarks = convertMaxMarks(dto.maxRawMarks, conversionWeightPct);
    const minPassMarks = dec(dto.minPassMarks ?? '0', 'minPassMarks').toFixed(2);
    if (dec(minPassMarks, 'minPassMarks').gt(convertedMaxMarks)) {
      throw new BadRequestException(
        `component ${dto.componentCode}: minPassMarks (${minPassMarks}) cannot exceed convertedMaxMarks (${convertedMaxMarks})`,
      );
    }

    return {
      componentCode: dto.componentCode,
      componentName: dto.componentName ?? dto.componentCode,
      sourceType,
      sourceComponentCode,
      maxRawMarks: dec(dto.maxRawMarks, 'maxRawMarks').toFixed(2),
      conversionWeightPct,
      convertedMaxMarks,
      minPassMarks,
      displayOrder: dto.displayOrder ?? 1,
    };
  }
}
