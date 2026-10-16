import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDateValue, toWire, toWireList } from '../prisma/wire';
import { CreateTeacherDto, UpdateTeacherDto } from './teacher.dto';

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.teachers.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return toWireList(rows);
  }

  async create(dto: CreateTeacherDto) {
    const { jointDate, ...rest } = dto;
    const row = await this.prisma.teachers.create({
      data: { ...rest, jointDate: toDateValue(jointDate) },
    });
    return toWire(row);
  }

  async update(id: string, dto: UpdateTeacherDto) {
    const teacher = await this.prisma.teachers.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException(`Teacher ${id} not found`);

    const { jointDate, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (jointDate !== undefined) data.jointDate = toDateValue(jointDate);

    const row = await this.prisma.teachers.update({ where: { id }, data });
    return toWire(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const teacher = await this.prisma.teachers.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException(`Teacher ${id} not found`);
    await this.prisma.teachers.delete({ where: { id } });
    return { id };
  }
}
