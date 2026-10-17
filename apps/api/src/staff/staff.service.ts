import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire, toWireList } from '../prisma/wire';
import { CreateStaffMemberDto, UpdateStaffMemberDto } from './staff-member.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.staffMembers.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return toWireList(rows);
  }

  async create(dto: CreateStaffMemberDto) {
    const row = await this.prisma.staffMembers.create({ data: { ...dto } });
    return toWire(row);
  }

  async update(id: string, dto: UpdateStaffMemberDto) {
    const member = await this.prisma.staffMembers.findUnique({ where: { id } });
    if (!member) throw new NotFoundException(`Staff member ${id} not found`);
    const row = await this.prisma.staffMembers.update({
      where: { id },
      data: { ...dto },
    });
    return toWire(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const member = await this.prisma.staffMembers.findUnique({ where: { id } });
    if (!member) throw new NotFoundException(`Staff member ${id} not found`);
    await this.prisma.staffMembers.delete({ where: { id } });
    return { id };
  }
}
