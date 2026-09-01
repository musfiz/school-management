import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slider } from '../database/entities/slider.entity';
import { CreateSliderDto, UpdateSliderDto } from './slider.dto';

@Injectable()
export class SlidersService {
  constructor(
    @InjectRepository(Slider)
    private readonly repo: Repository<Slider>,
  ) {}

  /** All slides, for the admin manager (includes inactive ones). */
  findAll(): Promise<Slider[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  /** Only active slides, for the public hero carousel. */
  findActive(): Promise<Slider[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  create(dto: CreateSliderDto): Promise<Slider> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateSliderDto): Promise<Slider> {
    const slider = await this.repo.findOne({ where: { id } });
    if (!slider) throw new NotFoundException(`Slider ${id} not found`);
    return this.repo.save(this.repo.merge(slider, dto));
  }

  async remove(id: number): Promise<{ id: number }> {
    const slider = await this.repo.findOne({ where: { id } });
    if (!slider) throw new NotFoundException(`Slider ${id} not found`);
    await this.repo.remove(slider);
    return { id };
  }
}
