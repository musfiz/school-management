import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire, toWireList } from '../prisma/wire';
import { CreateModuleDto, UpdateModuleDto } from './module.dto';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.modules.findMany({
      orderBy: { name: 'asc' },
    });
    return toWireList(rows);
  }

  async create(dto: CreateModuleDto) {
    const existing = await this.prisma.modules.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Module "${dto.name}" already exists`);
    }
    const row = await this.prisma.modules.create({ data: { ...dto } });
    return toWire(row);
  }

  async update(id: string, dto: UpdateModuleDto) {
    const module = await this.prisma.modules.findUnique({ where: { id } });
    if (!module) throw new NotFoundException(`Module ${id} not found`);
    if (dto.name && dto.name !== module.name) {
      const existing = await this.prisma.modules.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`Module "${dto.name}" already exists`);
      }
    }
    const row = await this.prisma.modules.update({
      where: { id },
      data: { ...dto },
    });
    return toWire(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const module = await this.prisma.modules.findUnique({ where: { id } });
    if (!module) throw new NotFoundException(`Module ${id} not found`);
    await this.prisma.modules.delete({ where: { id } });
    return { id };
  }
}
