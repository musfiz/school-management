import { NotFoundException } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const notice = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'n1',
  title: 'Annual Sports Day 2026',
  titleBn: null,
  slug: 'annual-sports-day-2026',
  category: 'General',
  shortDescription: null,
  shortDescriptionBn: null,
  description: null,
  descriptionBn: null,
  imageUrl: null,
  pdfUrl: null,
  isPinned: false,
  isActive: true,
  publishDate: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('NoticesService', () => {
  let prisma: PrismaMock;
  let service: NoticesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new NoticesService(asPrisma(prisma));
  });

  it('findAll keeps camelCase (the one module whose entity was already camelCase)', async () => {
    prisma.notices.findMany.mockResolvedValue([notice()]);

    const rows = await service.findAll(true);

    expect(prisma.notices.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [
        { isPinned: 'desc' },
        { publishDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect('created_at' in rows[0]).toBe(false);
  });

  it('findAll(false) drops the active filter', async () => {
    prisma.notices.findMany.mockResolvedValue([]);

    await service.findAll(false);

    expect(prisma.notices.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: [
        { isPinned: 'desc' },
        { publishDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  });

  it('findOne 404s for a missing id', async () => {
    prisma.notices.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findBySlug uses findFirst because slug is not unique', async () => {
    prisma.notices.findFirst.mockResolvedValue(notice());

    await service.findBySlug('annual-sports-day-2026');

    expect(prisma.notices.findFirst).toHaveBeenCalledWith({
      where: { slug: 'annual-sports-day-2026' },
    });
    expect(prisma.notices.findUnique).not.toHaveBeenCalled();
  });

  it('create slugifies the title when no slug is supplied', async () => {
    prisma.notices.create.mockResolvedValue(notice());

    await service.create({
      title: 'Annual Sports Day 2026!',
      publishDate: '2026-02-03',
    });

    const data = prisma.notices.create.mock.calls[0][0].data;
    expect(data.slug).toBe('annual-sports-day-2026');
    expect(data.publishDate).toEqual(new Date('2026-02-03T00:00:00.000Z'));
  });

  it('create keeps an explicit slug and defaults publishDate to today', async () => {
    prisma.notices.create.mockResolvedValue(notice());

    await service.create({ title: 'Hello', slug: 'custom-slug' });

    const data = prisma.notices.create.mock.calls[0][0].data;
    expect(data.slug).toBe('custom-slug');
    expect(data.publishDate).toBeInstanceOf(Date);
  });

  it('update recomputes the slug from the title when none is given', async () => {
    prisma.notices.findUnique.mockResolvedValue(notice());
    prisma.notices.update.mockResolvedValue(notice());

    await service.update('n1', { title: 'New Title!' });

    const data = prisma.notices.update.mock.calls[0][0].data;
    expect(prisma.notices.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({ slug: 'new-title' }),
    });
    expect(data.publishDate).toBeUndefined();
  });

  it('update converts a supplied publishDate', async () => {
    prisma.notices.findUnique.mockResolvedValue(notice());
    prisma.notices.update.mockResolvedValue(notice());

    await service.update('n1', {
      title: 'Annual Sports Day 2026',
      publishDate: '2026-03-04',
    });

    const data = prisma.notices.update.mock.calls[0][0].data;
    expect(data.publishDate).toEqual(new Date('2026-03-04T00:00:00.000Z'));
  });

  it('remove deletes an existing notice', async () => {
    prisma.notices.findUnique.mockResolvedValue(notice());
    prisma.notices.delete.mockResolvedValue(notice());

    await expect(service.remove('n1')).resolves.toBeUndefined();
    expect(prisma.notices.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
  });
});
