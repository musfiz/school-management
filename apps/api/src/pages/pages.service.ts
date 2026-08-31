import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from '../database/entities/page.entity';
import { UpsertPageDto } from './page.dto';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private readonly repo: Repository<Page>,
  ) {}

  /** Public read — 404s until an admin has saved this slug at least once. */
  async findBySlug(slug: string): Promise<Page> {
    const page = await this.repo.findOne({ where: { slug } });
    if (!page) throw new NotFoundException(`No page saved for slug "${slug}"`);
    return page;
  }

  /** Creates the row on first save, otherwise patches it in place. */
  async upsert(slug: string, dto: UpsertPageDto): Promise<Page> {
    const existing = await this.repo.findOne({ where: { slug } });
    const merged = this.repo.merge(existing ?? this.repo.create({ slug }), dto);
    return this.repo.save(merged);
  }
}
