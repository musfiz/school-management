import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import {
  asPrisma,
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock';

const permRow = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'results.view',
  description: null,
  moduleId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...over,
});

const moduleRow = () => ({
  id: 'm1',
  name: 'Website Management',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

describe('PermissionsService', () => {
  let prisma: PrismaMock;
  let service: PermissionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PermissionsService(asPrisma(prisma));
  });

  it('findAllPermissions renames moduleId/createdAt and maps modules→module', async () => {
    prisma.permissions.findMany.mockResolvedValue([
      { ...permRow({ moduleId: 'm1' }), modules: moduleRow(), userPermissions: [] },
    ]);

    const [row] = await service.findAllPermissions();

    expect(prisma.permissions.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      include: { modules: true },
    });
    expect(row).toEqual({
      id: 'p1',
      name: 'results.view',
      description: null,
      module_id: 'm1',
      created_at: expect.any(Date),
      module: { id: 'm1', name: 'Website Management', created_at: expect.any(Date) },
    });
    expect(row).not.toHaveProperty('modules');
    expect(row).not.toHaveProperty('moduleId');
  });

  it('findAllPermissions maps a null relation to module: null', async () => {
    prisma.permissions.findMany.mockResolvedValue([
      { ...permRow(), modules: null, userPermissions: [] },
    ]);

    const [row] = await service.findAllPermissions();
    expect(row.module).toBeNull();
  });

  it('createPermission rejects a duplicate name', async () => {
    prisma.permissions.findUnique.mockResolvedValue(permRow());

    await expect(
      service.createPermission({ name: 'results.view' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.permissions.create).not.toHaveBeenCalled();
  });

  it('createPermission 404s a missing module', async () => {
    prisma.permissions.findUnique.mockResolvedValue(null);
    prisma.modules.findUnique.mockResolvedValue(null);

    await expect(
      service.createPermission({ name: 'results.edit', module_id: 'm9' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.permissions.create).not.toHaveBeenCalled();
  });

  it('createPermission inserts and returns the wire row', async () => {
    prisma.permissions.findUnique.mockResolvedValue(null);
    prisma.permissions.create.mockResolvedValue(permRow());

    const out = await service.createPermission({ name: 'results.view' });

    expect(prisma.permissions.create).toHaveBeenCalledWith({
      data: { name: 'results.view', description: null, moduleId: null },
      include: { modules: true },
    });
    expect(out.created_at).toBeInstanceOf(Date);
    expect(out.module_id).toBeNull();
  });

  it('getUserPermissions returns the joined permission names', async () => {
    prisma.userPermissions.findMany.mockResolvedValue([
      { permissions: { name: 'a' } },
      { permissions: { name: 'b' } },
    ]);

    await expect(service.getUserPermissions('u1')).resolves.toEqual(['a', 'b']);
    expect(prisma.userPermissions.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { permissions: { select: { name: true } } },
    });
  });

  it('assignPermission is idempotent when the grant already exists', async () => {
    prisma.permissions.findUnique.mockResolvedValue(permRow());
    prisma.userPermissions.findUnique.mockResolvedValue({
      userId: 'u1',
      permissionId: 'p1',
      assignedBy: null,
      assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const out = await service.assignPermission('u1', 'results.view');

    expect(out).toEqual({
      user_id: 'u1',
      permission_id: 'p1',
      assigned_by: null,
      assigned_at: expect.any(Date),
    });
    expect(prisma.userPermissions.create).not.toHaveBeenCalled();
  });

  it('assignPermission 404s an unknown permission', async () => {
    prisma.permissions.findUnique.mockResolvedValue(null);

    await expect(
      service.assignPermission('u1', 'nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assignPermission creates the composite-key row', async () => {
    prisma.permissions.findUnique.mockResolvedValue(permRow());
    prisma.userPermissions.findUnique.mockResolvedValue(null);
    prisma.userPermissions.create.mockResolvedValue({
      userId: 'u1',
      permissionId: 'p1',
      assignedBy: 'admin-1',
      assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await service.assignPermission('u1', 'results.view', 'admin-1');

    expect(prisma.userPermissions.create).toHaveBeenCalledWith({
      data: { userId: 'u1', permissionId: 'p1', assignedBy: 'admin-1' },
    });
  });

  it('revokePermission deleteMany (mirrors TypeORM delete, no P2025)', async () => {
    prisma.permissions.findUnique.mockResolvedValue(permRow());
    prisma.userPermissions.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.revokePermission('u1', 'results.view'),
    ).resolves.toBeUndefined();
    expect(prisma.userPermissions.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', permissionId: 'p1' },
    });
  });

  it('setUserPermissions rejects unknown names', async () => {
    prisma.permissions.findMany.mockResolvedValue([{ name: 'a' }]);

    await expect(
      service.setUserPermissions('u1', ['a', 'b']),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userPermissions.deleteMany).not.toHaveBeenCalled();
  });

  it('setUserPermissions replaces the full set', async () => {
    prisma.permissions.findMany.mockResolvedValue([{ id: 'p1', name: 'a' }]);
    prisma.userPermissions.deleteMany.mockResolvedValue({ count: 0 });
    prisma.userPermissions.createMany.mockResolvedValue({ count: 1 });

    await service.setUserPermissions('u1', ['a'], 'admin-1');

    expect(prisma.userPermissions.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prisma.userPermissions.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', permissionId: 'p1', assignedBy: 'admin-1' }],
    });
  });

  it('setUserPermissions with an empty set only clears', async () => {
    prisma.permissions.findMany.mockResolvedValue([]);
    prisma.userPermissions.deleteMany.mockResolvedValue({ count: 0 });

    await service.setUserPermissions('u1', []);

    expect(prisma.userPermissions.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prisma.userPermissions.createMany).not.toHaveBeenCalled();
  });
});
