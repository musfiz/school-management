import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FamilyProfile } from '../database/entities/family-profile.entity';
import { Student } from '../database/entities/student.entity';
import { StudentEnrollment } from '../database/entities/student-enrollment.entity';

export interface FamilyChild {
  studentId: string;
  studentUniqueId: string;
  name: string;
  nameBn: string | null;
  gender: string;
  currentStatus: string;
  admissionDate: string;
  photoUrl: string | null;
  classOrDeptId: string | null;
  sectionOrBatchId: string | null;
  classRollNo: number | null;
  academicGroup: string | null;
  residenceType: string | null;
  quotaTag: string | null;
  isActiveEnrollment: boolean;
}

export interface FamilyDirectoryRow extends FamilyProfile {
  childCount: number;
  activeChildCount: number;
  children: FamilyChild[];
}

export interface ActiveSibling {
  studentId: string;
  studentUniqueId: string;
  name: string;
  status: string;
  classOrDeptId: string | null;
  sectionOrBatchId: string | null;
  classRollNo: number | null;
  academicGroup: string | null;
}

export interface SiblingWaiverSuggestion {
  waiverType: 'SIBLING';
  admissionFeePct: number;
  tuitionFeePct: number;
  reason: string;
}

/**
 * Workflow 1 — Smart Family Lookup & Automatic Sibling Waiver Detection
 * (docs/STUDENT_ADMISSION_PLAN.md §4 Workflow 1, Phase 2).
 *
 * Lookup keys: primary_guardian_phone (also matches mother / local-guardian
 * phones so a family is found whichever number the officer types) or
 * father/mother NID. Phone input is normalized so 01XXXXXXXXX and
 * +8801XXXXXXXXX hit the same row.
 *
 * Returns the family row (for UI auto-fill) + active siblings + the
 * configured sibling-waiver preset suggestion.
 */
@Injectable()
export class FamilyRegistryService {
  /** Default sibling preset until configurable presets land in settings. */
  static readonly SIBLING_WAIVER_PRESET = {
    waiverType: 'SIBLING',
    admissionFeePct: 25,
    tuitionFeePct: 20,
  } as const;

  constructor(
    @InjectRepository(FamilyProfile) private readonly families: Repository<FamilyProfile>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(StudentEnrollment) private readonly enrollments: Repository<StudentEnrollment>,
  ) {}

  async lookupByPhoneOrNid(rawQuery: string) {
    const query = (rawQuery ?? '').trim();
    const candidates = this.phoneCandidates(query);
    const qb = this.families.createQueryBuilder('f').where(
      `f.primary_guardian_phone IN (:...phones)
        OR f.mother_phone IN (:...phones)
        OR f.local_guardian_phone IN (:...phones)
        OR f.father_nid = :raw
        OR f.mother_nid = :raw`,
      { phones: candidates, raw: query },
    );
    const family = await qb.getOne();
    if (!family) return { found: false as const, query };

    const children = await this.students.find({
      where: { familyProfileId: family.id },
      order: { fullNameEn: 'ASC' },
    });
    const activeSiblings: ActiveSibling[] = [];
    for (const s of children) {
      const en = await this.enrollments.findOne({
        where: { studentId: s.id, isActive: true },
      });
      const active = Boolean(en) || s.currentStatus === 'ACTIVE';
      if (!active) continue;
      activeSiblings.push({
        studentId: s.id,
        studentUniqueId: s.studentUniqueId,
        name: s.fullNameEn,
        status: s.currentStatus,
        classOrDeptId: en?.classOrDeptId ?? null,
        sectionOrBatchId: en?.sectionOrBatchId ?? null,
        classRollNo: en?.classRollNo ?? null,
        academicGroup: en?.academicGroup ?? null,
      });
    }

    const suggestedWaiver: SiblingWaiverSuggestion | null =
      activeSiblings.length > 0
        ? {
            ...FamilyRegistryService.SIBLING_WAIVER_PRESET,
            reason: `${activeSiblings.length} active sibling(s) in family ${family.familyCode}`,
          }
        : null;

    return { found: true as const, family, activeSiblings, suggestedWaiver };
  }

  /**
   * Normalize BD mobile input to comparable candidates:
   * raw trimmed + digits-only + 0-leading local form.
   * e.g. "+880 1712-345678" → ["+880 1712-345678", "8801712345678", "01712345678"]
   */
  private phoneCandidates(query: string): string[] {
    const digits = query.replace(/\D/g, '');
    let local = digits;
    if (digits.length === 13 && digits.startsWith('880')) local = `0${digits.slice(3)}`;
    else if (digits.length === 12 && digits.startsWith('88')) local = `0${digits.slice(2)}`;
    return Array.from(new Set([query, digits, local].filter((c) => c.length > 0)));
  }

  /* ================= directory + zakat verification (Phase 2) ================= */

  /** Paged family directory with phone/code/name search + multi-sibling linkage. */
  async listFamilies(filters: {
    search?: string;
    zakatEligible?: boolean;
    limit?: number;
  }): Promise<FamilyDirectoryRow[]> {
    const qb = this.families
      .createQueryBuilder('f')
      .orderBy('f.createdAt', 'DESC')
      .take(Math.min(Math.max(filters.limit ?? 100, 1), 500));
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      qb.andWhere(
        `f.primary_guardian_phone LIKE :q OR f.family_code LIKE :q
         OR f.father_name_en LIKE :q OR f.mother_name_en LIKE :q OR f.father_nid LIKE :q`,
        { q },
      );
    }
    if (filters.zakatEligible !== undefined) {
      qb.andWhere('f.is_zakat_eligible_family = :z', { z: filters.zakatEligible });
    }
    return this.withChildren(await qb.getMany());
  }

  /** Single family + its full child/sibling roster (directory detail drawer). */
  async getFamily(id: string): Promise<FamilyDirectoryRow> {
    const family = await this.families.findOne({ where: { id } });
    if (!family) throw new NotFoundException(`Family #${id} not found`);
    const [row] = await this.withChildren([family]);
    return row;
  }

  /**
   * Attach each family's children (students) with their active enrollment so
   * the directory can render the multi-sibling linkage without N+1 queries.
   */
  private async withChildren(families: FamilyProfile[]): Promise<FamilyDirectoryRow[]> {
    if (families.length === 0) return [];
    const familyIds = families.map((f) => f.id);
    const students = await this.students.find({
      where: { familyProfileId: In(familyIds) },
      order: { fullNameEn: 'ASC' },
    });
    const studentIds = students.map((s) => s.id);
    const enrollments = studentIds.length
      ? await this.enrollments.find({ where: { studentId: In(studentIds), isActive: true } })
      : [];
    const enrollmentByStudent = new Map(enrollments.map((e) => [e.studentId, e]));

    const childrenByFamily = new Map<string, FamilyChild[]>();
    for (const s of students) {
      const en = enrollmentByStudent.get(s.id);
      const child: FamilyChild = {
        studentId: s.id,
        studentUniqueId: s.studentUniqueId,
        name: s.fullNameEn,
        nameBn: s.fullNameBn ?? null,
        gender: s.gender,
        currentStatus: s.currentStatus,
        admissionDate: s.admissionDate,
        photoUrl: s.photoUrl ?? null,
        classOrDeptId: en?.classOrDeptId ?? null,
        sectionOrBatchId: en?.sectionOrBatchId ?? null,
        classRollNo: en?.classRollNo ?? null,
        academicGroup: en?.academicGroup ?? null,
        residenceType: en?.residenceType ?? null,
        quotaTag: en?.quotaTag ?? null,
        isActiveEnrollment: Boolean(en) || s.currentStatus === 'ACTIVE',
      };
      const list = childrenByFamily.get(s.familyProfileId) ?? [];
      list.push(child);
      childrenByFamily.set(s.familyProfileId, list);
    }

    return families.map((f) => {
      const children = childrenByFamily.get(f.id) ?? [];
      return {
        ...f,
        childCount: children.length,
        activeChildCount: children.filter((c) => c.isActiveEnrollment).length,
        children,
      };
    });
  }

  /**
   * Zakat-eligibility verification — the human gate before Fund 02
   * (Lillah) boarding. Only an explicit verify action flips this flag;
   * admission flows only ever READ it.
   */
  async setZakatVerified(id: string, verified: boolean) {
    const family = await this.families.findOne({ where: { id } });
    if (!family) throw new NotFoundException(`Family #${id} not found`);
    family.isZakatEligibleFamily = verified;
    return this.families.save(family);
  }
}
