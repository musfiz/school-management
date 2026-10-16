import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { MenuItems } from '../generated/prisma/client';
import type { MenuLocation } from './menu-item.constants';
import { MenuChildInputDto, MenuItemInputDto } from './menu-item.dto';

/** A plain tree node shaped for the frontend — no internal ids beyond `id` itself. */
export interface MenuTreeNode {
  id: string;
  labelEn: string;
  labelBn: string | null;
  href: string;
  isVisible: boolean;
  children: MenuTreeNode[];
}

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  /** Build a nested tree from the flat, sort_order-ordered rows for a location. */
  private buildTree(rows: MenuItems[]): MenuTreeNode[] {
    const byParent = new Map<string | null, MenuItems[]>();
    for (const row of rows) {
      const key = row.parentId ?? null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(row);
      byParent.set(key, bucket);
    }
    const toNode = (row: MenuItems): MenuTreeNode => ({
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
    const rows = await this.prisma.menuItems.findMany({
      where: { menuLocation: location },
      orderBy: { sortOrder: 'asc' },
    });
    return this.buildTree(rows.filter((r) => r.isVisible));
  }

  /** Full tree including hidden items, for the dashboard menu builder. */
  async findFullTree(location: MenuLocation): Promise<MenuTreeNode[]> {
    const rows = await this.prisma.menuItems.findMany({
      where: { menuLocation: location },
      orderBy: { sortOrder: 'asc' },
    });
    return this.buildTree(rows);
  }

  /** Replace the entire tree for a location in one transaction: wipe, then
   *  re-insert in the order submitted (sort_order = array index). */
  async replaceTree(
    location: MenuLocation,
    items: MenuItemInputDto[],
  ): Promise<MenuTreeNode[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.menuItems.deleteMany({ where: { menuLocation: location } });

      const insertLevel = async (
        nodes: (MenuItemInputDto | MenuChildInputDto)[],
        parentId: string | null,
      ) => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const saved = await tx.menuItems.create({
            data: {
              menuLocation: location,
              parentId,
              labelEn: node.labelEn,
              labelBn: node.labelBn ?? null,
              href: node.href,
              isVisible: node.isVisible ?? true,
              sortOrder: i,
            },
          });
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
