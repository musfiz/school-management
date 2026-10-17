import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDateValue } from '../prisma/wire';
import { CreateNoticeDto, UpdateNoticeDto } from './notice.dto';

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** Notice is the one Wave 1 entity whose properties are already camelCase,
   *  so its rows need no wire-format remapping. */
  findAll(activeOnly = true) {
    return this.prisma.notices.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ isPinned: 'desc' }, { publishDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const notice = await this.prisma.notices.findUnique({ where: { id } });
    if (!notice) {
      throw new NotFoundException(`Notice #${id} not found`);
    }
    return notice;
  }

  async findBySlug(slug: string) {
    // `slug` is not unique on the table, so this is a findFirst (as TypeORM's
    // findOne was): returns the first match rather than erroring on duplicates.
    const notice = await this.prisma.notices.findFirst({ where: { slug } });
    if (!notice) {
      throw new NotFoundException(`Notice with slug "${slug}" not found`);
    }
    return notice;
  }

  async create(dto: CreateNoticeDto) {
    const slug = dto.slug || this.slugify(dto.title) || `notice-${Date.now()}`;
    return this.prisma.notices.create({
      data: {
        ...dto,
        slug,
        publishDate: dto.publishDate
          ? toDateValue(dto.publishDate)
          : new Date(new Date().toISOString().split('T')[0]),
      },
    });
  }

  async update(id: string, dto: UpdateNoticeDto) {
    await this.findOne(id);

    const { publishDate, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (publishDate !== undefined) data.publishDate = toDateValue(publishDate);
    if (dto.title && !dto.slug) data.slug = this.slugify(dto.title);

    return this.prisma.notices.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.notices.delete({ where: { id } });
  }
}
