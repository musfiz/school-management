import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire, toWireList } from '../prisma/wire';
import {
  CreateGoverningBodyMemberDto,
  UpdateGoverningBodyMemberDto,
} from './governing-body-member.dto';

@Injectable()
export class GoverningBodyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.governingBodyMembers.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return toWireList(rows);
  }

  async create(dto: CreateGoverningBodyMemberDto) {
    const row = await this.prisma.governingBodyMembers.create({
      data: { ...dto },
    });
    return toWire(row);
  }

  async update(id: string, dto: UpdateGoverningBodyMemberDto) {
    const member = await this.prisma.governingBodyMembers.findUnique({
      where: { id },
    });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    const row = await this.prisma.governingBodyMembers.update({
      where: { id },
      data: { ...dto },
    });
    return toWire(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const member = await this.prisma.governingBodyMembers.findUnique({
      where: { id },
    });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    await this.prisma.governingBodyMembers.delete({ where: { id } });
    return { id };
  }
}
