import { NotFoundException } from '@nestjs/common';
import type { IStorageProvider } from '../modules/storage/interfaces/storage-provider.interface';
import { TeacherService } from './teacher.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const teacher = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'a',
  name: 'Dr. A. Rahman',
  nameBn: null,
  designation: 'Principal',
  designationBn: null,
  department: null,
  departmentBn: null,
  imageUrl: null,
  jointDate: new Date('2020-06-01T00:00:00.000Z'),
  sortOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('TeacherService', () => {
  let prisma: PrismaMock;
  let service: TeacherService;

  beforeEach(() => {
    prisma = createPrismaMock();
    // Storage is never hit unless an imageUrl swap triggers orphan cleanup;
    // deleteFile resolves so cleanup paths stay silent in tests.
    const storage: Pick<IStorageProvider, 'deleteFile'> = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    service = new TeacherService(
      asPrisma(prisma),
      storage as unknown as IStorageProvider,
    );
  });

  it('findAll orders by sortOrder then id and maps timestamps', async () => {
    prisma.teachers.findMany.mockResolvedValue([teacher()]);

    const rows = await service.findAll();

    expect(prisma.teachers.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    expect(rows[0].created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect('createdAt' in rows[0]).toBe(false);
  });

  it('create converts a YYYY-MM-DD jointDate into a Date', async () => {
    prisma.teachers.create.mockResolvedValue(teacher());

    await service.create({
      name: 'Dr. A. Rahman',
      designation: 'Principal',
      jointDate: '2020-06-01',
    });

    const data = prisma.teachers.create.mock.calls[0][0].data;
    expect(data.jointDate).toEqual(new Date('2020-06-01T00:00:00.000Z'));
  });

  it('create leaves jointDate unset when not supplied', async () => {
    prisma.teachers.create.mockResolvedValue(teacher());

    await service.create({ name: 'X', designation: 'Teacher' });

    const data = prisma.teachers.create.mock.calls[0][0].data;
    expect(data.jointDate).toBeUndefined();
  });

  it('update converts a supplied jointDate but leaves others untouched', async () => {
    prisma.teachers.findUnique.mockResolvedValue(teacher());
    prisma.teachers.update.mockResolvedValue(teacher());

    await service.update('a', { department: 'Science', jointDate: '2019-01-02' });

    const data = prisma.teachers.update.mock.calls[0][0].data;
    expect(data.department).toBe('Science');
    expect(data.jointDate).toEqual(new Date('2019-01-02T00:00:00.000Z'));
  });

  it('update 404s for a missing teacher', async () => {
    prisma.teachers.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove deletes an existing teacher', async () => {
    prisma.teachers.findUnique.mockResolvedValue(teacher());
    prisma.teachers.delete.mockResolvedValue(teacher());

    await expect(service.remove('a')).resolves.toEqual({ id: 'a' });
  });
});
