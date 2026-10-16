import { NotFoundException } from '@nestjs/common';
import { SlidersService } from './sliders.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'a',
  imageUrl: '/a.jpg',
  titleEn: 'Hello',
  titleBn: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('SlidersService', () => {
  let prisma: PrismaMock;
  let service: SlidersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SlidersService(asPrisma(prisma));
  });

  it('findAll orders by sortOrder then id and maps timestamps to snake_case', async () => {
    prisma.sliders.findMany.mockResolvedValue([row()]);

    const slides = await service.findAll();

    expect(prisma.sliders.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    expect(slides[0]).toMatchObject({
      id: 'a',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect('createdAt' in slides[0]).toBe(false);
  });

  it('findActive restricts to active slides', async () => {
    prisma.sliders.findMany.mockResolvedValue([]);

    await service.findActive();

    expect(prisma.sliders.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  });

  it('create inserts the dto as-is and returns the wire row', async () => {
    prisma.sliders.create.mockResolvedValue(row({ id: 'new' }));

    const created = await service.create({ imageUrl: '/new.jpg', sortOrder: 3 });

    expect(prisma.sliders.create).toHaveBeenCalledWith({
      data: { imageUrl: '/new.jpg', sortOrder: 3 },
    });
    expect(created.id).toBe('new');
  });

  it('update 404s (and never writes) when the slide is missing', async () => {
    prisma.sliders.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { titleEn: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.sliders.update).not.toHaveBeenCalled();
  });

  it('update patches an existing slide', async () => {
    prisma.sliders.findUnique.mockResolvedValue(row());
    prisma.sliders.update.mockResolvedValue(row({ titleEn: 'Updated' }));

    const updated = await service.update('a', { titleEn: 'Updated' });

    expect(prisma.sliders.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { titleEn: 'Updated' },
    });
    expect(updated.titleEn).toBe('Updated');
  });

  it('remove deletes an existing slide and returns its id', async () => {
    prisma.sliders.findUnique.mockResolvedValue(row());
    prisma.sliders.delete.mockResolvedValue(row());

    await expect(service.remove('a')).resolves.toEqual({ id: 'a' });
    expect(prisma.sliders.delete).toHaveBeenCalledWith({ where: { id: 'a' } });
  });

  it('remove 404s for a missing slide', async () => {
    prisma.sliders.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.sliders.delete).not.toHaveBeenCalled();
  });
});
