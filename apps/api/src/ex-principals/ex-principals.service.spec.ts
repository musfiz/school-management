import { NotFoundException } from '@nestjs/common';
import { ExPrincipalsService } from './ex-principals.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const principal = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'a',
  name: 'Abdul Karim',
  nameBn: null,
  tenure: '1990 – 1998',
  imageUrl: null,
  sortOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('ExPrincipalsService', () => {
  let prisma: PrismaMock;
  let service: ExPrincipalsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ExPrincipalsService(asPrisma(prisma));
  });

  it('findAll orders by sortOrder then id and maps timestamps', async () => {
    prisma.exPrincipals.findMany.mockResolvedValue([principal()]);

    const rows = await service.findAll();

    expect(prisma.exPrincipals.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    expect(rows[0].created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect('createdAt' in rows[0]).toBe(false);
  });

  it('create inserts the dto', async () => {
    prisma.exPrincipals.create.mockResolvedValue(principal());

    await service.create({ name: 'Abdul Karim', tenure: '1990 – 1998' });

    expect(prisma.exPrincipals.create).toHaveBeenCalledWith({
      data: { name: 'Abdul Karim', tenure: '1990 – 1998' },
    });
  });

  it('update 404s for a missing principal', async () => {
    prisma.exPrincipals.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove deletes an existing principal', async () => {
    prisma.exPrincipals.findUnique.mockResolvedValue(principal());
    prisma.exPrincipals.delete.mockResolvedValue(principal());

    await expect(service.remove('a')).resolves.toEqual({ id: 'a' });
  });
});
