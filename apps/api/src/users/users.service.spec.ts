import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from '../database/entities/user-role.enum';
import {
  asPrisma,
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock';
import type { PermissionAssignmentService } from '../permission-assignment/permission-assignment.service';

const userRow = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  name: 'Jane Doe',
  email: 'jane@school.com',
  password: '$2a$10$hashed',
  role: 'student',
  phone: null,
  isActive: true,
  isVerified: false,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('UsersService', () => {
  let prisma: PrismaMock;
  let permissionAssignment: {
    assignRoleDefaultsToUser: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    permissionAssignment = {
      assignRoleDefaultsToUser: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(
      asPrisma(prisma),
      permissionAssignment as unknown as PermissionAssignmentService,
    );
  });

  it('create rejects a duplicate email without inserting', async () => {
    prisma.users.findUnique.mockResolvedValue(userRow());

    await expect(
      service.create({
        name: 'Jane',
        email: 'jane@school.com',
        password: 'secret1',
        role: UserRole.STUDENT,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it('create inserts the DTO and returns snake_case created_at', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    prisma.users.create.mockResolvedValue(userRow());

    const out = await service.create({
      name: 'Jane',
      email: 'jane@school.com',
      password: 'secret1',
      role: UserRole.STUDENT,
    });

    expect(prisma.users.create).toHaveBeenCalledWith({
      data: {
        name: 'Jane',
        email: 'jane@school.com',
        password: 'secret1',
        role: UserRole.STUDENT,
      },
    });
    expect(out.created_at).toBeInstanceOf(Date);
    expect('createdAt' in out).toBe(false);
  });

  it('create auto-assigns role-default menu permissions inside the transaction', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    prisma.users.create.mockResolvedValue(userRow({ role: UserRole.TEACHER }));

    await service.create({
      name: 'Jane',
      email: 'jane@school.com',
      password: 'secret1',
      role: UserRole.TEACHER,
    });

    expect(permissionAssignment.assignRoleDefaultsToUser).toHaveBeenCalledTimes(1);
    const [userId, role, tx] = permissionAssignment.assignRoleDefaultsToUser.mock.calls[0];
    expect(userId).toBe('u1');
    expect(role).toBe(UserRole.TEACHER);
    // Third arg must be the tx client handed to the $transaction callback —
    // defaults join the same transaction as the user insert.
    expect(tx).toBe(prisma);
  });

  it('findAll selects the same subset the TypeORM query used', async () => {
    prisma.users.findMany.mockResolvedValue([userRow()]);

    const rows = await service.findAll();

    expect(prisma.users.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
    });
    expect(rows[0]).toHaveProperty('created_at');
    expect(prisma.users.findMany.mock.calls[0][0].select.password).toBeUndefined();
    expect(prisma.users.findMany.mock.calls[0][0].select.updatedAt).toBeUndefined();
  });

  it('findOne 404s for a missing id', async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findByEmail maps a missing email to null', async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    await expect(service.findByEmail('nobody@school.com')).resolves.toBeNull();
    expect(prisma.users.findUnique).toHaveBeenCalledWith({
      where: { email: 'nobody@school.com' },
    });
  });

  it('update 404s before touching the row, and never selects the password', async () => {
    await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('update writes the DTO and excludes password from the response select', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.users.update.mockResolvedValue(userRow());

    const out = await service.update('u1', { name: 'Janet' });

    const args = prisma.users.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'u1' });
    expect(args.data).toEqual({ name: 'Janet' });
    expect(args.select.password).toBeUndefined();
    expect(args.select.updatedAt).toBe(true);
    expect(out.updated_at).toBeInstanceOf(Date);
  });

  it('remove confirms existence then deletes', async () => {
    prisma.users.findUnique.mockResolvedValue(userRow());
    prisma.users.delete.mockResolvedValue(userRow());

    await expect(service.remove('u1')).resolves.toBeUndefined();
    expect(prisma.users.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('remove 404s for a missing id', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.users.delete).not.toHaveBeenCalled();
  });

  it('updateLastLogin writes only lastLoginAt', async () => {
    prisma.users.update.mockResolvedValue(userRow());

    await service.updateLastLogin('u1');

    const args = prisma.users.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'u1' });
    expect(args.data.lastLoginAt).toBeInstanceOf(Date);
    expect(Object.keys(args.data)).toEqual(['lastLoginAt']);
  });
});
