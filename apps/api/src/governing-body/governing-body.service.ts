import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoverningBodyMember } from '../database/entities/governing-body-member.entity';
import {
  CreateGoverningBodyMemberDto,
  UpdateGoverningBodyMemberDto,
} from './governing-body-member.dto';

@Injectable()
export class GoverningBodyService {
  constructor(
    @InjectRepository(GoverningBodyMember)
    private readonly repo: Repository<GoverningBodyMember>,
  ) {}

  findAll(): Promise<GoverningBodyMember[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  create(dto: CreateGoverningBodyMemberDto): Promise<GoverningBodyMember> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateGoverningBodyMemberDto): Promise<GoverningBodyMember> {
    const member = await this.repo.findOne({ where: { id } });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    return this.repo.save(this.repo.merge(member, dto));
  }

  async remove(id: number): Promise<{ id: number }> {
    const member = await this.repo.findOne({ where: { id } });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    await this.repo.remove(member);
    return { id };
  }
}
