import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from '../database/entities/teacher.entity';
import { CreateTeacherDto, UpdateTeacherDto } from './teacher.dto';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(Teacher)
    private readonly repo: Repository<Teacher>,
  ) {}

  findAll(): Promise<Teacher[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  create(dto: CreateTeacherDto): Promise<Teacher> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateTeacherDto): Promise<Teacher> {
    const teacher = await this.repo.findOne({ where: { id } });
    if (!teacher) throw new NotFoundException(`Teacher ${id} not found`);
    return this.repo.save(this.repo.merge(teacher, dto));
  }

  async remove(id: number): Promise<{ id: number }> {
    const teacher = await this.repo.findOne({ where: { id } });
    if (!teacher) throw new NotFoundException(`Teacher ${id} not found`);
    await this.repo.remove(teacher);
    return { id };
  }
}
