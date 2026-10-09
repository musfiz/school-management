import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HomepageSection } from '../database/entities/homepage-section.entity';
import { HomepageItem } from '../database/entities/homepage-item.entity';
import {
  CreateHomepageSectionDto,
  HomepageItemInputDto,
  UpdateHomepageSectionDto,
} from './homepage.dto';

/** A section plus its visible items, as consumed by the public homepage. */
export interface HomepageSectionWithItems extends HomepageSection {
  items: HomepageItem[];
}

@Injectable()
export class HomepageService {
  constructor(
    @InjectRepository(HomepageSection)
    private readonly sectionRepo: Repository<HomepageSection>,
    @InjectRepository(HomepageItem)
    private readonly itemRepo: Repository<HomepageItem>,
  ) {}

  /** Visible sections with their visible items, in display order. Used by the
   *  public homepage. Empty when nothing is seeded or the DB is empty. */
  async findVisible(): Promise<HomepageSectionWithItems[]> {
    const sections = await this.sectionRepo.find({
      where: { isVisible: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    if (sections.length === 0) return [];

    const items = await this.itemRepo.find({
      where: { sectionId: In(sections.map((s) => s.id)), isVisible: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });

    const bySection = new Map<number, HomepageItem[]>();
    for (const item of items) {
      const bucket = bySection.get(item.sectionId);
      if (bucket) bucket.push(item);
      else bySection.set(item.sectionId, [item]);
    }

    return sections.map((section) => ({ ...section, items: bySection.get(section.id) ?? [] }));
  }

  /** All sections including hidden ones, for the dashboard. */
  findAll(): Promise<HomepageSection[]> {
    return this.sectionRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  findSectionById(id: number): Promise<HomepageSection | null> {
    return this.sectionRepo.findOne({ where: { id } });
  }

  /** All items for one section (including hidden), for the dashboard editor. */
  findItems(sectionId: number): Promise<HomepageItem[]> {
    return this.itemRepo.find({ where: { sectionId }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async create(dto: CreateHomepageSectionDto): Promise<HomepageSection> {
    const duplicate = await this.sectionRepo.findOne({ where: { sectionKey: dto.sectionKey } });
    if (duplicate) {
      throw new ConflictException(
        `A homepage section with key "${dto.sectionKey}" already exists. Section keys must be unique.`,
      );
    }

    const section = await this.sectionRepo.save(this.sectionRepo.create(dto));
    await this.replaceItems(section.id, dto.items);
    return section;
  }

  async update(id: number, dto: UpdateHomepageSectionDto): Promise<HomepageSection> {
    const section = await this.findSectionById(id);
    if (!section) throw new NotFoundException(`Homepage section ${id} not found`);

    // `sectionKey` is intentionally absent from the update DTO: the public
    // renderer maps it to a component, so changing it in the dashboard would
    // silently break the homepage. Create a new section instead.
    const { items, ...fields } = dto;
    await this.sectionRepo.save(this.sectionRepo.merge(section, fields));

    if (items) await this.replaceItems(id, items);
    return this.sectionRepo.findOne({ where: { id } }) as Promise<HomepageSection>;
  }

  async remove(id: number): Promise<{ id: number }> {
    const section = await this.findSectionById(id);
    if (!section) throw new NotFoundException(`Homepage section ${id} not found`);
    // Items cascade at the DB level; delete explicitly so the same code path
    // works against a database that hasn't run the FK yet.
    await this.itemRepo.delete({ sectionId: id });
    await this.sectionRepo.remove(section);
    return { id };
  }

  /**
   * Replaces a section's items with `items` wholesale, matching by `id` so
   * editing one row doesn't churn the ids of the others (which would also
   * reset any image the admin just uploaded). Rows without an id are inserted;
   * rows that are gone are deleted.
   */
  private async replaceItems(sectionId: number, items: HomepageItemInputDto[] | undefined): Promise<void> {
    if (!items) return;

    const existing = await this.itemRepo.find({ where: { sectionId } });
    const existingById = new Map(existing.map((row) => [row.id, row]));
    const keptIds = new Set<number>();

    for (const [index, input] of items.entries()) {
      const sortOrder = input.sortOrder ?? index;
      if (input.id && existingById.has(input.id)) {
        keptIds.add(input.id);
        await this.itemRepo.save(
          this.itemRepo.merge(existingById.get(input.id)!, { ...input, sectionId, sortOrder }),
        );
      } else {
        const created = await this.itemRepo.save(
          this.itemRepo.create({ ...input, sectionId, sortOrder }),
        );
        keptIds.add(created.id);
      }
    }

    const removed = existing.filter((row) => !keptIds.has(row.id)).map((row) => row.id);
    if (removed.length > 0) await this.itemRepo.delete({ id: In(removed) });
  }
}