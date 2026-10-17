import { NotFoundException } from '@nestjs/common';
import { PagesService } from './pages.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const page = (over: Partial<Record<string, unknown>> = {}) => ({
  slug: 'about-us',
  titleEn: 'About Us',
  titleBn: 'আমাদের সম্পর্কে',
  contentEn: 'Body',
  contentBn: null,
  imageUrl: null,
  showInHomepage: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('PagesService', () => {
  let prisma: PrismaMock;
  let service: PagesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PagesService(asPrisma(prisma));
  });

  it('findBySlug returns the mapped row', async () => {
    prisma.pages.findUnique.mockResolvedValue(page());

    const found = await service.findBySlug('about-us');

    expect(prisma.pages.findUnique).toHaveBeenCalledWith({
      where: { slug: 'about-us' },
    });
    expect(found).toMatchObject({
      slug: 'about-us',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect('createdAt' in found).toBe(false);
  });

  it('findBySlug 404s when the slug has never been saved', async () => {
    prisma.pages.findUnique.mockResolvedValue(null);

    await expect(service.findBySlug('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('upsert creates with the route slug plus body, and updates otherwise', async () => {
    prisma.pages.upsert.mockResolvedValue(page());

    await service.upsert('about-us', { titleEn: 'About Us', showInHomepage: true });

    expect(prisma.pages.upsert).toHaveBeenCalledWith({
      where: { slug: 'about-us' },
      create: { slug: 'about-us', titleEn: 'About Us', showInHomepage: true },
      update: { titleEn: 'About Us', showInHomepage: true },
    });
  });
});
