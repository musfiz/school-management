import { ConflictException, NotFoundException } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const moduleRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'm1',
  name: 'Website Management',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...over,
});

describe('ModulesService', () => {
  let prisma: PrismaMock;
  let service: ModulesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ModulesService(asPrisma(prisma));
  });

  it('findAll orders by name and maps createdAt to created_at', async () => {
    prisma.modules.findMany.mockResolvedValue([moduleRow()]);

    const rows = await service.findAll();

    expect(prisma.modules.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
    expect(Object.keys(rows[0]).sort()).toEqual(['created_at', 'id', 'name']);
    expect(rows[0].created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('create rejects a duplicate name with 409', async () => {
    prisma.modules.findUnique.mockResolvedValue(moduleRow());

    await expect(
      service.create({ name: 'Website Management' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.modules.create).not.toHaveBeenCalled();
  });

  it('create inserts a new module', async () => {
    prisma.modules.findUnique.mockResolvedValue(null);
    prisma.modules.create.mockResolvedValue(moduleRow({ id: 'new' }));

    const created = await service.create({ name: 'Website Management' });

    expect(prisma.modules.create).toHaveBeenCalledWith({
      data: { name: 'Website Management' },
    });
    expect(created.id).toBe('new');
  });

  it('update 404s for a missing module', async () => {
    prisma.modules.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update rejects renaming onto another existing module', async () => {
    prisma.modules.findUnique
      .mockResolvedValueOnce(moduleRow({ id: 'm1', name: 'A' }))
      .mockResolvedValueOnce(moduleRow({ id: 'm2', name: 'B' }));

    await expect(service.update('m1', { name: 'B' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.modules.update).not.toHaveBeenCalled();
  });

  it('update skips the uniqueness check when the name is unchanged', async () => {
    prisma.modules.findUnique.mockResolvedValue(moduleRow());
    prisma.modules.update.mockResolvedValue(moduleRow());

    await service.update('m1', { name: 'Website Management' });

    expect(prisma.modules.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.modules.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { name: 'Website Management' },
    });
  });

  it('remove deletes an existing module', async () => {
    prisma.modules.findUnique.mockResolvedValue(moduleRow());
    prisma.modules.delete.mockResolvedValue(moduleRow());

    await expect(service.remove('m1')).resolves.toEqual({ id: 'm1' });
  });
});
