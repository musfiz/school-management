import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire, toWireList } from '../prisma/wire';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  isManagedFileKey,
} from '../modules/storage/interfaces/storage-provider.interface';
import { CreateGalleryDto, UpdateGalleryDto } from './gallery.dto';

@Injectable()
export class GalleriesService {
  private readonly logger = new Logger(GalleriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  /** All gallery items for the manager (includes inactive ones). */
  async findAll() {
    const rows = await (this.prisma as any).galleries.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return toWireList(rows);
  }

  /** Only active gallery items for the public site. */
  async findActive() {
    const rows = await (this.prisma as any).galleries.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return toWireList(rows);
  }

  async findOne(id: string) {
    const row = await (this.prisma as any).galleries.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Gallery item ${id} not found`);
    return toWire(row);
  }

  async create(dto: CreateGalleryDto) {
    const row = await (this.prisma as any).galleries.create({
      data: {
        imageUrl: dto.imageUrl,
        titleEn: dto.titleEn ?? null,
        titleBn: dto.titleBn ?? null,
        subtitleEn: dto.subtitleEn ?? null,
        subtitleBn: dto.subtitleBn ?? null,
        tagEn: dto.tagEn ?? null,
        tagBn: dto.tagBn ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    return toWire(row);
  }

  async update(id: string, dto: UpdateGalleryDto) {
    const item = await (this.prisma as any).galleries.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Gallery item ${id} not found`);

    const row = await (this.prisma as any).galleries.update({
      where: { id },
      data: { ...dto },
    });

    // Cleanup previous image if replaced with a new managed key
    if (
      dto.imageUrl !== undefined &&
      dto.imageUrl !== item.imageUrl &&
      isManagedFileKey(item.imageUrl)
    ) {
      await this.storage
        .deleteFile(item.imageUrl)
        .catch((err: unknown) =>
          this.logger.warn(`Orphan cleanup failed for ${item.imageUrl}: ${String(err)}`),
        );
    }

    return toWire(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const item = await (this.prisma as any).galleries.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Gallery item ${id} not found`);

    await (this.prisma as any).galleries.delete({ where: { id } });

    if (isManagedFileKey(item.imageUrl)) {
      await this.storage
        .deleteFile(item.imageUrl)
        .catch((err: unknown) =>
          this.logger.warn(`Orphan cleanup failed for ${item.imageUrl}: ${String(err)}`),
        );
    }

    return { id };
  }
}
