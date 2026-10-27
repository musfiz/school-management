import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire, toWireList } from '../prisma/wire';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  isManagedFileKey,
} from '../modules/storage/interfaces/storage-provider.interface';
import { CreateRoutineDto, QueryRoutineDto, UpdateRoutineDto } from './routine.dto';

const ROUTINE_INCLUDES = {
  academicSession: {
    select: {
      id: true,
      sessionName: true,
      sessionCode: true,
      isCurrent: true,
    },
  },
  classOrDept: {
    select: {
      id: true,
      name: true,
      code: true,
      level: true,
    },
  },
  academicGroup: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

@Injectable()
export class RoutinesService {
  private readonly logger = new Logger(RoutinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(STORAGE_PROVIDER)
    private readonly storage?: IStorageProvider,
  ) {}

  private buildWhere(query?: QueryRoutineDto, isActiveOnly = false) {
    const where: any = {};
    if (isActiveOnly) {
      where.isActive = true;
    }
    if (query?.academicSessionId) {
      where.academicSessionId = query.academicSessionId;
    }
    if (query?.classOrDeptId) {
      where.classOrDeptId = query.classOrDeptId;
    }
    if (query?.academicGroupId) {
      where.academicGroupId = query.academicGroupId;
    }
    if (query?.type) {
      where.type = query.type;
    }
    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term } },
        { titleBn: { contains: term } },
        { description: { contains: term } },
        { classOrDept: { name: { contains: term } } },
        { academicGroup: { name: { contains: term } } },
      ];
    }
    return where;
  }

  /** Public list: only active routines, sorted by order and date. */
  async findActive(query?: QueryRoutineDto) {
    const rows = await (this.prisma as any).routines.findMany({
      where: this.buildWhere(query, true),
      include: ROUTINE_INCLUDES,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    return toWireList(rows);
  }

  /** Admin / Management list: includes inactive routines. */
  async findAll(query?: QueryRoutineDto) {
    const rows = await (this.prisma as any).routines.findMany({
      where: this.buildWhere(query, false),
      include: ROUTINE_INCLUDES,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    return toWireList(rows);
  }

  async findOne(id: string) {
    const row = await (this.prisma as any).routines.findUnique({
      where: { id },
      include: ROUTINE_INCLUDES,
    });
    if (!row) throw new NotFoundException(`Routine ${id} not found`);
    return toWire(row);
  }

  async create(dto: CreateRoutineDto) {
    const row = await (this.prisma as any).routines.create({
      data: {
        title: dto.title.trim(),
        titleBn: dto.titleBn?.trim() || null,
        academicSessionId: dto.academicSessionId,
        classOrDeptId: dto.classOrDeptId,
        academicGroupId: dto.academicGroupId || null,
        type: dto.type || 'CLASS',
        pdfUrl: dto.pdfUrl.trim(),
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: ROUTINE_INCLUDES,
    });
    return toWire(row);
  }

  async update(id: string, dto: UpdateRoutineDto) {
    const existing = await (this.prisma as any).routines.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Routine ${id} not found`);

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.titleBn !== undefined) data.titleBn = dto.titleBn?.trim() || null;
    if (dto.academicSessionId !== undefined) data.academicSessionId = dto.academicSessionId;
    if (dto.classOrDeptId !== undefined) data.classOrDeptId = dto.classOrDeptId;
    if (dto.academicGroupId !== undefined) data.academicGroupId = dto.academicGroupId || null;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.pdfUrl !== undefined) data.pdfUrl = dto.pdfUrl.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const row = await (this.prisma as any).routines.update({
      where: { id },
      data,
      include: ROUTINE_INCLUDES,
    });

    if (
      dto.pdfUrl !== undefined &&
      dto.pdfUrl !== existing.pdfUrl &&
      this.storage &&
      isManagedFileKey(existing.pdfUrl)
    ) {
      await this.storage
        .deleteFile(existing.pdfUrl)
        .catch((err: unknown) =>
          this.logger.warn(`Orphan cleanup failed for routine ${existing.pdfUrl}: ${String(err)}`),
        );
    }

    return toWire(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const existing = await (this.prisma as any).routines.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Routine ${id} not found`);

    await (this.prisma as any).routines.delete({ where: { id } });

    if (this.storage && isManagedFileKey(existing.pdfUrl)) {
      await this.storage
        .deleteFile(existing.pdfUrl)
        .catch((err: unknown) =>
          this.logger.warn(`Orphan cleanup failed for routine ${existing.pdfUrl}: ${String(err)}`),
        );
    }

    return { id };
  }
}
