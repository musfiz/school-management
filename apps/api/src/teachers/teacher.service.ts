import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toDateValue, toWire, toWireList } from '../prisma/wire';
import { CreateTeacherDto, UpdateTeacherDto } from './teacher.dto';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  isManagedFileKey,
} from '../modules/storage/interfaces/storage-provider.interface';

@Injectable()
export class TeacherService {
  private readonly logger = new Logger(TeacherService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  async findAll() {
    const rows = await this.prisma.teachers.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return toWireList(rows);
  }

  async create(dto: CreateTeacherDto) {
    const { jointDate, ...rest } = dto;
    const row = await this.prisma.teachers.create({
      data: { ...rest, jointDate: toDateValue(jointDate) },
    });
    return toWire(row);
  }

  async update(id: string, dto: UpdateTeacherDto) {
    const teacher = await this.prisma.teachers.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException(`Teacher ${id} not found`);

    const { jointDate, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (jointDate !== undefined) data.jointDate = toDateValue(jointDate);

    const row = await this.prisma.teachers.update({ where: { id }, data });

    // Replace-cleanup: when a form PATCH swaps in a new managed photo key,
    // delete the old managed file (never hand-written legacy URLs).
    const previousImage = teacher.imageUrl;
    const nextImage = dto.imageUrl;
    if (
      nextImage !== undefined &&
      nextImage !== previousImage &&
      isManagedFileKey(previousImage)
    ) {
      await this.storage
        .deleteFile(previousImage)
        .catch((error: unknown) =>
          this.logger.warn(
            `Orphan cleanup failed for ${previousImage}: ${String(error)}`,
          ),
        );
    }

    return toWire(row);
  }

  /** Direct photo endpoint support — swaps in the new key, returns the old one. */
  async updatePhoto(id: string, avatarKey: string): Promise<string | null> {
    const teacher = await this.prisma.teachers.findUnique({
      where: { id },
      select: { id: true, imageUrl: true },
    });
    if (!teacher) throw new NotFoundException(`Teacher ${id} not found`);

    await this.prisma.teachers.update({
      where: { id },
      data: { imageUrl: avatarKey }, // Prisma column: imageUrl VarChar(255)
    });
    // Only managed keys are returned for cleanup; could be null/undefined too.
    return isManagedFileKey(teacher.imageUrl) ? teacher.imageUrl : null;
  }

  async remove(id: string): Promise<{ id: string }> {
    const teacher = await this.prisma.teachers.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException(`Teacher ${id} not found`);
    await this.prisma.teachers.delete({ where: { id } });
    return { id };
  }
}
