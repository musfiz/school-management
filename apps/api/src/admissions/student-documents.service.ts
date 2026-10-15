import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Student } from '../database/entities/student.entity';
import { StudentEnrollment } from '../database/entities/student-enrollment.entity';
import { StudentDocument } from '../database/entities/student-document.entity';

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
  constructor(
    @InjectRepository(StudentDocument) private readonly documents: Repository<StudentDocument>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(StudentEnrollment) private readonly enrollments: Repository<StudentEnrollment>,
  ) {}

  types(): string[] {
    return [...STUDENT_DOCUMENT_TYPES];
  }

  /** The per-student checklist (all rows on record + canonical type list). */
  async listForStudent(studentId: string) {
    const student = await this.students.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);
    const [documents, enrollment] = await Promise.all([
      this.documents.find({ where: { studentId }, order: { uploadedAt: 'DESC' } }),
      this.enrollments.findOne({ where: { studentId, isActive: true } }),
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
  ): Promise<StudentDocument> {
    const student = await this.students.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Student #${studentId} not found`);
    const documentType = this.normalizeType(dto.documentType);
    const fileUrl = (dto.fileUrl ?? '').trim();
    if (!fileUrl) throw new BadRequestException('fileUrl is required');

    const existing = await this.documents.findOne({ where: { studentId, documentType } });
    if (existing) {
      existing.fileUrl = fileUrl;
      if (dto.isOriginalSubmitted !== undefined) existing.isOriginalSubmitted = dto.isOriginalSubmitted;
      existing.verifiedBy = null; // re-upload needs re-verification
      return this.documents.save(existing);
    }
    return this.documents.save(
      this.documents.create({
        studentId,
        documentType,
        fileUrl,
        isOriginalSubmitted: dto.isOriginalSubmitted ?? false,
        verifiedBy: null,
      }),
    );
  }

  /** Flip the original-submitted flag / swap the file (re-upload clears verify). */
  async update(
    id: string,
    dto: { fileUrl?: string; isOriginalSubmitted?: boolean },
  ): Promise<StudentDocument> {
    const doc = await this.find(id);
    if (dto.fileUrl !== undefined) {
      const fileUrl = dto.fileUrl.trim();
      if (!fileUrl) throw new BadRequestException('fileUrl cannot be empty');
      doc.fileUrl = fileUrl;
      doc.verifiedBy = null;
    }
    if (dto.isOriginalSubmitted !== undefined) doc.isOriginalSubmitted = dto.isOriginalSubmitted;
    return this.documents.save(doc);
  }

  /** Human verification gate — stamps (or clears) `verifiedBy`. */
  async setVerified(id: string, verified: boolean, actorId: string): Promise<StudentDocument> {
    const doc = await this.find(id);
    doc.verifiedBy = verified ? actorId : null;
    return this.documents.save(doc);
  }

  async remove(id: string) {
    const doc = await this.find(id);
    await this.documents.remove(doc);
    return { id, deleted: true };
  }

  /** Verification queue / directory: per-student document counts. */
  async summary(filters: { search?: string; onlyPending?: boolean; limit?: number }) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const qb = this.students.createQueryBuilder('s').orderBy('s.createdAt', 'DESC').take(limit);
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      qb.andWhere('(s.fullNameEn LIKE :q OR s.fullNameBn LIKE :q OR s.studentUniqueId LIKE :q)', { q });
    }
    const students = await qb.getMany();

    const rows: StudentDocumentSummaryRow[] = [];
    if (students.length > 0) {
      const ids = students.map((s) => s.id);
      const [agg, enrollments] = await Promise.all([
        this.documents
          .createQueryBuilder('d')
          .select('d.studentId', 'sid')
          .addSelect('COUNT(*)', 'total')
          .addSelect('SUM(CASE WHEN d.verifiedBy IS NULL THEN 0 ELSE 1 END)', 'verified')
          .addSelect('SUM(d.isOriginalSubmitted)', 'originals')
          .where('d.studentId IN (:...ids)', { ids })
          .groupBy('d.studentId')
          .getRawMany<{ sid: string; total: string; verified: string; originals: string }>(),
        this.enrollments.find({ where: { studentId: In(ids), isActive: true } }),
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

  private async find(id: string): Promise<StudentDocument> {
    const doc = await this.documents.findOne({ where: { id } });
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
