import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffMember } from '../database/entities/staff-member.entity';
import { CreateStaffMemberDto, UpdateStaffMemberDto } from './staff-member.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffMember)
    private readonly repo: Repository<StaffMember>,
  ) {}

  findAll(): Promise<StaffMember[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  create(dto: CreateStaffMemberDto): Promise<StaffMember> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateStaffMemberDto): Promise<StaffMember> {
    const member = await this.repo.findOne({ where: { id } });
    if (!member) throw new NotFoundException(`Staff member ${id} not found`);
    return this.repo.save(this.repo.merge(member, dto));
  }

  async remove(id: number): Promise<{ id: number }> {
    const member = await this.repo.findOne({ where: { id } });
    if (!member) throw new NotFoundException(`Staff member ${id} not found`);
    await this.repo.remove(member);
    return { id };
  }
}
