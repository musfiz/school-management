import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDateValue } from '../prisma/wire';

/**
 * Standalone CRUD for a student's previous-education trail
 * (Plan §3.3 — student_previous_educations).
 *
 * Used by transfer-in admissions: a student previously sat an exam
 * (PSC / JSC / SSC / Dakhil / HSC / Alim …) at another institute, and the
 * admin records exam title, institute, board, group, roll/reg, passing year,
 * GPA and the TC number + date trail.
 */
@Injectable()
export class PreviousEducationService {
  constructor(private readonly prisma: PrismaService) {}

  /** List previous-education rows, optionally scoped to one student. */
  async list(studentId?: string) {
    return this.prisma.studentPreviousEducations.findMany({
      where: studentId ? { studentId } : {},
      orderBy: [{ passingYear: 'desc' }, { examTitle: 'asc' }],
    });
  }

  /** Create one previous-education row for a student. */
  async create(dto: {
    studentId: string;
    examTitle: string;
    instituteName: string;
    educationBoard?: string | null;
    academicGroup?: string | null;
    rollNo?: string | null;
    regNo?: string | null;
    passingYear?: number | null;
    gpaObtained?: string | null;
    tcNumber?: string | null;
    tcDate?: string | null;
  }) {
    const student = await this.prisma.students.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException(`Student #${dto.studentId} not found`);

    return this.prisma.studentPreviousEducations.create({
      data: {
        studentId: dto.studentId,
        examTitle: dto.examTitle,
        instituteName: dto.instituteName,
        educationBoard: dto.educationBoard ?? null,
        academicGroup: dto.academicGroup ?? null,
        rollNo: dto.rollNo ?? null,
        regNo: dto.regNo ?? null,
        passingYear: dto.passingYear ?? null,
        gpaObtained: dto.gpaObtained ?? null,
        gpaScale: '5.00',
        tcNumber: dto.tcNumber ?? null,
        tcDate: dto.tcDate ? toDateValue(String(dto.tcDate).slice(0, 10)) : null,
      },
    });
  }

  /** Update one previous-education row. */
  async update(
    id: string,
    dto: Partial<{
      examTitle: string;
      instituteName: string;
      educationBoard: string | null;
      academicGroup: string | null;
      rollNo: string | null;
      regNo: string | null;
      passingYear: number | null;
      gpaObtained: string | null;
      tcNumber: string | null;
      tcDate: string | null;
    }>,
  ) {
    const existing = await this.prisma.studentPreviousEducations.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Previous education #${id} not found`);

    return this.prisma.studentPreviousEducations.update({
      where: { id },
      data: {
        ...(dto.examTitle !== undefined ? { examTitle: dto.examTitle } : {}),
        ...(dto.instituteName !== undefined ? { instituteName: dto.instituteName } : {}),
        ...(dto.educationBoard !== undefined ? { educationBoard: dto.educationBoard } : {}),
        ...(dto.academicGroup !== undefined ? { academicGroup: dto.academicGroup } : {}),
        ...(dto.rollNo !== undefined ? { rollNo: dto.rollNo } : {}),
        ...(dto.regNo !== undefined ? { regNo: dto.regNo } : {}),
        ...(dto.passingYear !== undefined ? { passingYear: dto.passingYear } : {}),
        ...(dto.gpaObtained !== undefined ? { gpaObtained: dto.gpaObtained } : {}),
        ...(dto.tcNumber !== undefined ? { tcNumber: dto.tcNumber } : {}),
        ...(dto.tcDate !== undefined
          ? { tcDate: dto.tcDate ? toDateValue(String(dto.tcDate).slice(0, 10)) : null }
          : {}),
      },
    });
  }

  /** Delete one previous-education row. */
  async remove(id: string) {
    const existing = await this.prisma.studentPreviousEducations.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Previous education #${id} not found`);
    await this.prisma.studentPreviousEducations.delete({ where: { id } });
    return { id, deleted: true };
  }
}
