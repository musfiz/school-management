import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { StudentDocuments } from '../generated/prisma/client';

/**
 * Canonical document checklist (Plan §3.5). Free-form in the DB, but the UI
 * renders this set plus any extra types already on record.
 */
export const STUDENT_DOCUMENT_TYPES = [
  'BIRTH_CERT',
  'PHOTO',
  'FATHER_NID',
  'MOTHER_NID',
  'TC_COPY',
  'SSC_MARKSHEET',
  'HSC_MARKSHEET',
  'TESTIMONIAL',
  'MIGRATION_CERT',
  'ORPHAN_CERT',
] as const;

export interface StudentDocumentSummaryRow {
  studentId: string;
  studentUniqueId: string;
  fullNameEn: string;
  currentStatus: string;
  classOrDeptId: string | null;
  sectionOrBatchId: string | null;
  uploaded: number;
  verified: number;
  pending: number;
  originalsHeld: number;
}

/**
 * Phase 5 — Student Documents & Verification Checklist (Plan §3.5).
 * One row per (student, document_type): a re-upload replaces the file and
 * clears the verifier stamp so an officer must re-verify. `verifiedBy` is the
 * audited human gate (original-transcript holds at Colleges/Universities).
 */
@Injectable()
export class StudentDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  types(): string[] {
    return [...STUDENT_DOCUMENT_TYPES];
  }

  /** The per-student checklist (all rows on record + canonical type list). */
  async listForStudent(studentId: string) {
    const student = await this.prisma.students.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);
    const [documents, enrollment] = await Promise.all([
      this.prisma.studentDocuments.findMany({
        where: { studentId },
        orderBy: { uploadedAt: 'desc' },
      }),
      this.prisma.studentEnrollments.findFirst({
        where: { studentId, isActive: true },
      }),
    ]);
    return {
      student: {
        id: student.id,
        studentUniqueId: student.studentUniqueId,
        fullNameEn: student.fullNameEn,
        fullNameBn: student.fullNameBn ?? null,
        currentStatus: student.currentStatus,
        classOrDeptId: enrollment?.classOrDeptId ?? null,
        sectionOrBatchId: enrollment?.sectionOrBatchId ?? null,
      },
      documents,
      types: STUDENT_DOCUMENT_TYPES,
    };
  }

  /** Add or replace a document for a student (clears verification on replace). */
  async upsert(
    studentId: string,
    dto: { documentType: string; fileUrl: string; isOriginalSubmitted?: boolean },
  ): Promise<StudentDocuments> {
    const student = await this.prisma.students.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);
    const documentType = this.normalizeType(dto.documentType);
    const fileUrl = (dto.fileUrl ?? '').trim();
    if (!fileUrl) throw new BadRequestException('fileUrl is required');

    const existing = await this.prisma.studentDocuments.findFirst({
      where: { studentId, documentType },
    });
    if (existing) {
      return this.prisma.studentDocuments.update({
        where: { id: existing.id },
        data: {
          fileUrl,
          ...(dto.isOriginalSubmitted !== undefined
            ? { isOriginalSubmitted: dto.isOriginalSubmitted }
            : {}),
          verifiedBy: null, // re-upload needs re-verification
        },
      });
    }
    return this.prisma.studentDocuments.create({
      data: {
        studentId,
        documentType,
        fileUrl,
        isOriginalSubmitted: dto.isOriginalSubmitted ?? false,
        verifiedBy: null,
      },
    });
  }

  /** Flip the original-submitted flag / swap the file (re-upload clears verify). */
  async update(
    id: string,
    dto: { fileUrl?: string; isOriginalSubmitted?: boolean },
  ): Promise<StudentDocuments> {
    const doc = await this.find(id);
    const data: Prisma.StudentDocumentsUncheckedUpdateInput = {};
    if (dto.fileUrl !== undefined) {
      const fileUrl = dto.fileUrl.trim();
      if (!fileUrl) throw new BadRequestException('fileUrl cannot be empty');
      data.fileUrl = fileUrl;
      data.verifiedBy = null;
    }
    if (dto.isOriginalSubmitted !== undefined) data.isOriginalSubmitted = dto.isOriginalSubmitted;
    return this.prisma.studentDocuments.update({ where: { id: doc.id }, data });
  }

  /** Human verification gate — stamps (or clears) `verifiedBy`. */
  async setVerified(id: string, verified: boolean, actorId: string): Promise<StudentDocuments> {
    await this.find(id);
    return this.prisma.studentDocuments.update({
      where: { id },
      data: { verifiedBy: verified ? actorId : null },
    });
  }

  async remove(id: string) {
    await this.find(id);
    await this.prisma.studentDocuments.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Verification queue / directory: per-student document counts. */
  async summary(filters: { search?: string; onlyPending?: boolean; limit?: number }) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const where: Prisma.StudentsWhereInput = {};
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { fullNameEn: { contains: q } },
        { fullNameBn: { contains: q } },
        { studentUniqueId: { contains: q } },
      ];
    }
    const students = await this.prisma.students.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const rows: StudentDocumentSummaryRow[] = [];
    if (students.length > 0) {
      const ids = students.map((s) => s.id);
      const [agg, enrollments] = await Promise.all([
        this.prisma.$queryRaw<
          { sid: string; total: bigint | number; verified: bigint | number; originals: bigint | number | null }[]
        >(Prisma.sql`
          SELECT d.student_id AS sid,
                 COUNT(*) AS total,
                 SUM(CASE WHEN d.verified_by IS NULL THEN 0 ELSE 1 END) AS verified,
                 SUM(d.is_original_submitted) AS originals
          FROM student_documents d
          WHERE d.student_id IN (${Prisma.join(ids)})
          GROUP BY d.student_id
        `),
        this.prisma.studentEnrollments.findMany({
          where: { studentId: { in: ids }, isActive: true },
        }),
      ]);
      const byStudent = new Map(agg.map((r) => [r.sid, r]));
      const enByStudent = new Map(enrollments.map((e) => [e.studentId, e]));

      for (const s of students) {
        const a = byStudent.get(s.id);
        const uploaded = a ? Number(a.total) : 0;
        const verified = a ? Number(a.verified) : 0;
        const en = enByStudent.get(s.id);
        rows.push({
          studentId: s.id,
          studentUniqueId: s.studentUniqueId,
          fullNameEn: s.fullNameEn,
          currentStatus: s.currentStatus,
          classOrDeptId: en?.classOrDeptId ?? null,
          sectionOrBatchId: en?.sectionOrBatchId ?? null,
          uploaded,
          verified,
          pending: uploaded - verified,
          originalsHeld: a ? Number(a.originals) : 0,
        });
      }
    }

    const filtered = filters.onlyPending ? rows.filter((r) => r.pending > 0 || r.uploaded === 0) : rows;
    const totals = filtered.reduce(
      (t, r) => ({
        students: t.students + 1,
        uploaded: t.uploaded + r.uploaded,
        verified: t.verified + r.verified,
        pending: t.pending + r.pending,
        originalsHeld: t.originalsHeld + r.originalsHeld,
      }),
      { students: 0, uploaded: 0, verified: 0, pending: 0, originalsHeld: 0 },
    );

    return { types: STUDENT_DOCUMENT_TYPES, rows: filtered, totals };
  }

  private async find(id: string): Promise<StudentDocuments> {
    const doc = await this.prisma.studentDocuments.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document #${id} not found`);
    return doc;
  }

  private normalizeType(raw: string): string {
    const type = (raw ?? '').trim().toUpperCase();
    if (!type) throw new BadRequestException('documentType is required');
    if (type.length > 40) throw new BadRequestException('documentType must be 40 characters or fewer');
    return type;
  }
}
