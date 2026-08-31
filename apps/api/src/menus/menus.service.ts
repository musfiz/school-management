import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MenuItem, MenuLocation } from '../database/entities/menu-item.entity';
import { MenuChildInputDto, MenuItemInputDto } from './menu-item.dto';

/** A plain tree node shaped for the frontend — no internal ids beyond `id` itself. */
export interface MenuTreeNode {
  id: number;
  labelEn: string;
  labelBn: string | null;
  href: string;
  isVisible: boolean;
  children: MenuTreeNode[];
}

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuRepo: Repository<MenuItem>,
    private readonly dataSource: DataSource,
  ) {}

  /** Build a nested tree from the flat, sort_order-ordered rows for a location. */
  private buildTree(rows: MenuItem[]): MenuTreeNode[] {
    const byParent = new Map<number | null, MenuItem[]>();
    for (const row of rows) {
      const key = row.parentId ?? null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(row);
      byParent.set(key, bucket);
    }
    const toNode = (row: MenuItem): MenuTreeNode => ({
      id: row.id,
      labelEn: row.labelEn,
      labelBn: row.labelBn ?? null,
      href: row.href,
      isVisible: row.isVisible,
      children: (byParent.get(row.id) ?? []).map(toNode),
    });
    return (byParent.get(null) ?? []).map(toNode);
  }

  /** Public tree — visible items only, for rendering the live site header. */
  async findPublicTree(location: MenuLocation): Promise<MenuTreeNode[]> {
    const rows = await this.menuRepo.find({
      where: { menuLocation: location },
      order: { sortOrder: 'ASC' },
    });
    const tree = this.buildTree(rows.filter((r) => r.isVisible));
    return tree;
  }

  /** Full tree including hidden items, for the dashboard menu builder. */
  async findFullTree(location: MenuLocation): Promise<MenuTreeNode[]> {
    const rows = await this.menuRepo.find({
      where: { menuLocation: location },
      order: { sortOrder: 'ASC' },
    });
    return this.buildTree(rows);
  }

  /** Replace the entire tree for a location in one transaction: wipe, then
   *  re-insert in the order submitted (sort_order = array index). */
  async replaceTree(
    location: MenuLocation,
    items: MenuItemInputDto[],
  ): Promise<MenuTreeNode[]> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(MenuItem);
      await repo.delete({ menuLocation: location });

      const insertLevel = async (
        nodes: (MenuItemInputDto | MenuChildInputDto)[],
        parentId: number | null,
      ) => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const saved = await repo.save(
            repo.create({
              menuLocation: location,
              parentId,
              labelEn: node.labelEn,
              labelBn: node.labelBn ?? null,
              href: node.href,
              isVisible: node.isVisible ?? true,
              sortOrder: i,
            }),
          );
          if ('children' in node && node.children?.length) {
            await insertLevel(node.children, saved.id);
          }
        }
      };

      await insertLevel(items, null);
    });

    return this.findFullTree(location);
  }
}
