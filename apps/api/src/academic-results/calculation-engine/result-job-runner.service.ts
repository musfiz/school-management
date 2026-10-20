import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { EngineOutput } from '../common/mapper.util';
import { PreFlightService } from './pre-flight.service';
import { ResultCalculationService } from './result-calculation.service';

interface ExecuteResult {
  ok: boolean;
  error?: string;
  output?: EngineOutput;
}

/**
 * AD-2 — the in-DB job runner (no Redis/BullMQ).
 *
 * Lifecycle: `QUEUED → RUNNING → COMPLETED | FAILED`. One active job per exam
 * term; the term keeps a single job row whose status/progress always describe
 * the latest run (CC-15). Work starts after the HTTP request returns, in
 * `setImmediate`, and every write happens inside the calculation service's
 * single transaction so a mid-run failure leaves the previous snapshot intact.
 */
@Injectable()
export class ResultJobRunnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculation: ResultCalculationService,
    private readonly preFlight: PreFlightService,
  ) {}

  preflight(examTermId: string) {
    return this.preFlight.check(examTermId);
  }

  /** Queues a background run and returns the job row immediately. */
  async start(examTermId: string, actorId: string) {
    const term = await this.requireTerm(examTermId);
    this.assertGeneratable(term);

    const active = await this.prisma.resultGenerationJobs.findFirst({
      where: { examTermId, status: { in: ['QUEUED', 'RUNNING'] } },
    });
    if (active) {
      throw new ConflictException(`Result generation is already ${active.status} (job ${active.id})`);
    }

    const report = await this.preFlight.check(examTermId);
    if (!report.ok) {
      throw new UnprocessableEntityException({
        message: 'Pre-flight validation failed',
        blockers: report.blockers,
      });
    }

    const job = await this.ensureJobRow(examTermId, actorId, report.students);
    setImmediate(() => {
      void this.execute(job.id);
    });
    return job;
  }

  /** Synchronous generation (small classes, tests, and CLI use). */
  async runNow(examTermId: string, actorId: string) {
    const term = await this.requireTerm(examTermId);
    this.assertGeneratable(term);

    const report = await this.preFlight.check(examTermId);
    if (!report.ok) {
      throw new UnprocessableEntityException({
        message: 'Pre-flight validation failed',
        blockers: report.blockers,
      });
    }

    const job = await this.ensureJobRow(examTermId, actorId, report.students);
    const result = await this.execute(job.id);
    if (!result.ok) {
      throw new UnprocessableEntityException({
        message: 'Result generation failed',
        error: result.error,
      });
    }
    return {
      job: await this.get(job.id),
      subjectRows: result.output?.subjectRows.length ?? 0,
      marksheets: result.output?.marksheets.length ?? 0,
      warnings: result.output?.warnings ?? [],
    };
  }

  async get(jobId: string) {
    const job = await this.prisma.resultGenerationJobs.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Result generation job #${jobId} not found`);
    return job;
  }

  listForTerm(examTermId: string) {
    return this.prisma.resultGenerationJobs.findMany({
      where: { examTermId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /* ================= internals ================= */

  private async execute(jobId: string): Promise<ExecuteResult> {
    const job = await this.prisma.resultGenerationJobs.findUnique({ where: { id: jobId } });
    if (!job) return { ok: false, error: `Job #${jobId} not found` };

    if (!job.requestedBy) {
      const message = 'Result generation needs a requesting user (requested_by is null)';
      await this.fail(jobId, message);
      return { ok: false, error: message };
    }
    const actorId = job.requestedBy;

    await this.prisma.resultGenerationJobs.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        currentStage: 'SYNC_AUTO_COMPONENTS',
        progressPct: 2,
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
      },
    });

    try {
      const output = await this.calculation.generate(job.examTermId, actorId, async (stage, pct) => {
        await this.prisma.resultGenerationJobs
          .update({
            where: { id: jobId },
            data: { currentStage: stage, progressPct: Math.max(0, Math.min(99, pct)) },
          })
          .catch(() => undefined);
      });

      await this.prisma.resultGenerationJobs.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          currentStage: 'DONE',
          progressPct: 100,
          processedStudents: job.totalStudents,
          finishedAt: new Date(),
          errorMessage: output.warnings.length
            ? truncate(output.warnings.slice(0, 3).join('; '))
            : null,
        },
      });
      return { ok: true, output };
    } catch (error) {
      const message = messageOf(error);
      await this.fail(jobId, message);
      return { ok: false, error: message };
    }
  }

  /** Reuses the term's existing job row so a term always has exactly one (CC-15). */
  private async ensureJobRow(examTermId: string, actorId: string, totalStudents: number) {
    const data = {
      status: 'QUEUED',
      progressPct: 0,
      currentStage: 'QUEUED',
      totalStudents,
      processedStudents: 0,
      errorMessage: null,
      requestedBy: actorId,
      startedAt: null,
      finishedAt: null,
    };
    const existing = await this.prisma.resultGenerationJobs.findFirst({
      where: { examTermId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.prisma.resultGenerationJobs.update({ where: { id: existing.id }, data });
    }
    return this.prisma.resultGenerationJobs.create({ data: { examTermId, ...data } });
  }

  private async fail(jobId: string, message: string): Promise<void> {
    await this.prisma.resultGenerationJobs
      .update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          currentStage: 'FAILED',
          finishedAt: new Date(),
          errorMessage: truncate(message),
        },
      })
      .catch(() => undefined);
  }

  private async requireTerm(examTermId: string) {
    const term = await this.prisma.examTerms.findUnique({ where: { id: examTermId } });
    if (!term) throw new NotFoundException(`Exam term #${examTermId} not found`);
    return term;
  }

  /** CC-18 — results may only be generated from `MARKS_ENTRY`. */
  private assertGeneratable(term: { status: string }): void {
    if (term.status !== 'MARKS_ENTRY') {
      throw new BadRequestException(
        `Generation is only allowed from MARKS_ENTRY (term is ${term.status})`,
      );
    }
  }
}

function truncate(value: string, max = 500): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function messageOf(error: unknown): string {
  if (error instanceof BadRequestException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    const payload = response as { message?: string | string[] };
    const message = Array.isArray(payload.message) ? payload.message.join('; ') : payload.message;
    if (message) return message;
  }
  return error instanceof Error ? error.message : String(error);
}
