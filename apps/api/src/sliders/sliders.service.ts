import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire, toWireList } from '../prisma/wire';
import { CreateSliderDto, UpdateSliderDto } from './slider.dto';

@Injectable()
export class SlidersService {
  constructor(private readonly prisma: PrismaService) {}

  /** All slides, for the admin manager (includes inactive ones). */
  async findAll() {
    const rows = await this.prisma.sliders.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return toWireList(rows);
  }

  /** Only active slides, for the public hero carousel. */
  async findActive() {
    const rows = await this.prisma.sliders.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return toWireList(rows);
  }

  async create(dto: CreateSliderDto) {
    const row = await this.prisma.sliders.create({ data: { ...dto } });
    return toWire(row);
  }

  async update(id: string, dto: UpdateSliderDto) {
    const slider = await this.prisma.sliders.findUnique({ where: { id } });
    if (!slider) throw new NotFoundException(`Slider ${id} not found`);
    const row = await this.prisma.sliders.update({
      where: { id },
      data: { ...dto },
    });
    return toWire(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const slider = await this.prisma.sliders.findUnique({ where: { id } });
    if (!slider) throw new NotFoundException(`Slider ${id} not found`);
    await this.prisma.sliders.delete({ where: { id } });
    return { id };
  }
}
