import { NotFoundException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const member = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'a',
  name: 'Fatema Begum',
  nameBn: null,
  designation: 'Assistant Teacher',
  designationBn: null,
  imageUrl: null,
  sortOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('StaffService', () => {
  let prisma: PrismaMock;
  let service: StaffService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new StaffService(asPrisma(prisma));
  });

  it('findAll orders by sortOrder then id and maps timestamps', async () => {
    prisma.staffMembers.findMany.mockResolvedValue([member()]);

    const rows = await service.findAll();

    expect(prisma.staffMembers.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    expect(rows[0].created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect('createdAt' in rows[0]).toBe(false);
  });

  it('create inserts the dto', async () => {
    prisma.staffMembers.create.mockResolvedValue(member());

    await service.create({ name: 'Fatema Begum', designation: 'Assistant Teacher' });

    expect(prisma.staffMembers.create).toHaveBeenCalledWith({
      data: { name: 'Fatema Begum', designation: 'Assistant Teacher' },
    });
  });

  it('update 404s for a missing member', async () => {
    prisma.staffMembers.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove deletes an existing member', async () => {
    prisma.staffMembers.findUnique.mockResolvedValue(member());
    prisma.staffMembers.delete.mockResolvedValue(member());

    await expect(service.remove('a')).resolves.toEqual({ id: 'a' });
  });
});
