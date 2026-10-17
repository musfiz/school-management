import { MenusService } from './menus.service';
import {
  asPrisma,
  createPrismaMock,
  PrismaMock,
} from '../../test/support/prisma-mock';

const menuRow = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  menuLocation: 'header',
  parentId: null,
  labelEn: 'A',
  labelBn: null,
  href: '/a',
  sortOrder: 0,
  isVisible: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...over,
});

describe('MenusService', () => {
  let prisma: PrismaMock;
  let service: MenusService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new MenusService(asPrisma(prisma));
  });

  it('findPublicTree drops hidden items and nests children', async () => {
    prisma.menuItems.findMany.mockResolvedValue([
      menuRow({ id: 'a', labelEn: 'A', sortOrder: 0 }),
      menuRow({
        id: 'a1',
        parentId: 'a',
        labelEn: 'A1',
        sortOrder: 0,
        isVisible: false,
      }),
      menuRow({ id: 'b', labelEn: 'B', labelBn: 'ব', sortOrder: 1 }),
    ]);

    const tree = await service.findPublicTree('header');

    expect(prisma.menuItems.findMany).toHaveBeenCalledWith({
      where: { menuLocation: 'header' },
      orderBy: { sortOrder: 'asc' },
    });
    expect(tree.map((n) => n.labelEn)).toEqual(['A', 'B']);
    expect(tree[0].children).toEqual([]); // the only child was hidden
  });

  it('findFullTree keeps hidden items and nests children', async () => {
    prisma.menuItems.findMany.mockResolvedValue([
      menuRow({ id: 'a', labelEn: 'A' }),
      menuRow({ id: 'a1', parentId: 'a', labelEn: 'A1', isVisible: false }),
    ]);

    const tree = await service.findFullTree('header');

    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.labelEn)).toEqual(['A1']);
    expect(tree[0].children[0].isVisible).toBe(false);
  });

  it('replaceTree wipes and re-inserts the whole tree in one transaction', async () => {
    prisma.menuItems.deleteMany.mockResolvedValue({ count: 0 });
    prisma.menuItems.create
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ id: 'a1' })
      .mockResolvedValueOnce({ id: 'b' });
    prisma.menuItems.findMany.mockResolvedValue([]);

    const out = await service.replaceTree('header', [
      {
        labelEn: 'A',
        href: '/a',
        children: [{ labelEn: 'A1', href: '/a1' }],
      },
      { labelEn: 'B', href: '/b', isVisible: false },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.menuItems.deleteMany).toHaveBeenCalledWith({
      where: { menuLocation: 'header' },
    });

    const creates = prisma.menuItems.create.mock.calls.map((c) => c[0].data);
    expect(creates[0]).toMatchObject({
      menuLocation: 'header',
      parentId: null,
      labelEn: 'A',
      sortOrder: 0,
      isVisible: true,
    });
    expect(creates[1]).toMatchObject({ labelEn: 'A1', parentId: 'a', sortOrder: 0 });
    expect(creates[2]).toMatchObject({
      labelEn: 'B',
      parentId: null,
      sortOrder: 1,
      isVisible: false,
    });
    expect(out).toEqual([]);
  });
});
