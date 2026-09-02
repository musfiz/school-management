import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from '../database/entities/module.entity';
import { CreateModuleDto, UpdateModuleDto } from './module.dto';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(Module)
    private readonly repo: Repository<Module>,
  ) {}

  findAll(): Promise<Module[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateModuleDto): Promise<Module> {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Module "${dto.name}" already exists`);
    }
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateModuleDto): Promise<Module> {
    const module = await this.repo.findOne({ where: { id } });
    if (!module) throw new NotFoundException(`Module ${id} not found`);
    if (dto.name && dto.name !== module.name) {
      const existing = await this.repo.findOne({ where: { name: dto.name } });
      if (existing) {
        throw new ConflictException(`Module "${dto.name}" already exists`);
      }
    }
    return this.repo.save(this.repo.merge(module, dto));
  }

  async remove(id: number): Promise<{ id: number }> {
    const module = await this.repo.findOne({ where: { id } });
    if (!module) throw new NotFoundException(`Module ${id} not found`);
    await this.repo.remove(module);
    return { id };
  }
}
