import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire, toWireList } from '../prisma/wire';
import { CreateExPrincipalDto, UpdateExPrincipalDto } from './ex-principal.dto';

@Injectable()
export class ExPrincipalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.exPrincipals.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return toWireList(rows);
  }

  async create(dto: CreateExPrincipalDto) {
    const row = await this.prisma.exPrincipals.create({ data: { ...dto } });
    return toWire(row);
  }

  async update(id: string, dto: UpdateExPrincipalDto) {
    const principal = await this.prisma.exPrincipals.findUnique({
      where: { id },
    });
    if (!principal) throw new NotFoundException(`Ex-principal ${id} not found`);
    const row = await this.prisma.exPrincipals.update({
      where: { id },
      data: { ...dto },
    });
    return toWire(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const principal = await this.prisma.exPrincipals.findUnique({
      where: { id },
    });
    if (!principal) throw new NotFoundException(`Ex-principal ${id} not found`);
    await this.prisma.exPrincipals.delete({ where: { id } });
    return { id };
  }
}
