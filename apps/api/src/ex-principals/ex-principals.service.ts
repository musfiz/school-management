import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExPrincipal } from '../database/entities/ex-principal.entity';
import { CreateExPrincipalDto, UpdateExPrincipalDto } from './ex-principal.dto';

@Injectable()
export class ExPrincipalsService {
  constructor(
    @InjectRepository(ExPrincipal)
    private readonly repo: Repository<ExPrincipal>,
  ) {}

  findAll(): Promise<ExPrincipal[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  create(dto: CreateExPrincipalDto): Promise<ExPrincipal> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateExPrincipalDto): Promise<ExPrincipal> {
    const principal = await this.repo.findOne({ where: { id } });
    if (!principal) throw new NotFoundException(`Ex-principal ${id} not found`);
    return this.repo.save(this.repo.merge(principal, dto));
  }

  async remove(id: number): Promise<{ id: number }> {
    const principal = await this.repo.findOne({ where: { id } });
    if (!principal) throw new NotFoundException(`Ex-principal ${id} not found`);
    await this.repo.remove(principal);
    return { id };
  }
}
