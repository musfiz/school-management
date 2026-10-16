import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire } from '../prisma/wire';
import { UpsertPageDto } from './page.dto';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public read — 404s until an admin has saved this slug at least once. */
  async findBySlug(slug: string) {
    const page = await this.prisma.pages.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`No page saved for slug "${slug}"`);
    return toWire(page);
  }

  /** Creates the row on first save, otherwise patches it in place. */
  async upsert(slug: string, dto: UpsertPageDto) {
    const page = await this.prisma.pages.upsert({
      where: { slug },
      create: { slug, ...dto },
      update: { ...dto },
    });
    return toWire(page);
  }
}
