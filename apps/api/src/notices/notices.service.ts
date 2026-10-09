import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from '../database/entities/notice.entity';
import { CreateNoticeDto, UpdateNoticeDto } from './notice.dto';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepo: Repository<Notice>,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async findAll(activeOnly = true): Promise<Notice[]> {
    const query = this.noticeRepo.createQueryBuilder('notice');
    if (activeOnly) {
      query.where('notice.isActive = :isActive', { isActive: true });
    }
    return query
      .orderBy('notice.isPinned', 'DESC')
      .addOrderBy('notice.publishDate', 'DESC')
      .addOrderBy('notice.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: number): Promise<Notice> {
    const notice = await this.noticeRepo.findOne({ where: { id } });
    if (!notice) {
      throw new NotFoundException(`Notice #${id} not found`);
    }
    return notice;
  }

  async findBySlug(slug: string): Promise<Notice> {
    const notice = await this.noticeRepo.findOne({ where: { slug } });
    if (!notice) {
      throw new NotFoundException(`Notice with slug "${slug}" not found`);
    }
    return notice;
  }

  async create(dto: CreateNoticeDto): Promise<Notice> {
    const slug = dto.slug || this.slugify(dto.title) || `notice-${Date.now()}`;
    const notice = this.noticeRepo.create({
      ...dto,
      slug,
      publishDate: dto.publishDate || new Date().toISOString().split('T')[0],
    });
    return this.noticeRepo.save(notice);
  }

  async update(id: number, dto: UpdateNoticeDto): Promise<Notice> {
    const notice = await this.findOne(id);
    Object.assign(notice, dto);
    if (dto.title && !dto.slug) {
      notice.slug = this.slugify(dto.title);
    }
    return this.noticeRepo.save(notice);
  }

  async remove(id: number): Promise<void> {
    const notice = await this.findOne(id);
    await this.noticeRepo.remove(notice);
  }
}
