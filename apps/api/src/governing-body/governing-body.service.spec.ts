import { NotFoundException } from '@nestjs/common';
import { GoverningBodyService } from './governing-body.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const member = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'a',
  name: 'John Doe',
  nameBn: null,
  designation: 'Chairperson',
  designationBn: null,
  imageUrl: null,
  sortOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('GoverningBodyService', () => {
  let prisma: PrismaMock;
  let service: GoverningBodyService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new GoverningBodyService(asPrisma(prisma));
  });

  it('findAll orders by sortOrder then id and maps timestamps', async () => {
    prisma.governingBodyMembers.findMany.mockResolvedValue([member()]);

    const rows = await service.findAll();

    expect(prisma.governingBodyMembers.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    expect(rows[0].created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect('createdAt' in rows[0]).toBe(false);
  });

  it('create inserts the dto', async () => {
    prisma.governingBodyMembers.create.mockResolvedValue(member());

    await service.create({ name: 'John Doe', designation: 'Chairperson' });

    expect(prisma.governingBodyMembers.create).toHaveBeenCalledWith({
      data: { name: 'John Doe', designation: 'Chairperson' },
    });
  });

  it('update 404s for a missing member', async () => {
    prisma.governingBodyMembers.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove deletes an existing member', async () => {
    prisma.governingBodyMembers.findUnique.mockResolvedValue(member());
    prisma.governingBodyMembers.delete.mockResolvedValue(member());

    await expect(service.remove('a')).resolves.toEqual({ id: 'a' });
  });
});
