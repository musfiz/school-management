import { HeroSectionService } from './hero-section.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

const hero = (over: Partial<Record<string, unknown>> = {}) => ({
  id: SINGLETON_ID,
  isVisible: true,
  admissionYear: '2026–2027',
  tagline1: 'Building Tomorrow’s Leaders',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('HeroSectionService', () => {
  let prisma: PrismaMock;
  let service: HeroSectionService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new HeroSectionService(asPrisma(prisma));
  });

  it('find returns the existing singleton, mapped to snake_case', async () => {
    prisma.heroSections.findUnique.mockResolvedValue(hero());

    const row = await service.find();

    expect(prisma.heroSections.findUnique).toHaveBeenCalledWith({
      where: { id: SINGLETON_ID },
    });
    expect(row.created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect('createdAt' in row).toBe(false);
  });

  it('find seeds the singleton with defaults when absent', async () => {
    prisma.heroSections.findUnique.mockResolvedValue(null);
    prisma.heroSections.create.mockResolvedValue(hero());

    await service.find();

    const data = prisma.heroSections.create.mock.calls[0][0].data;
    expect(data.id).toBe(SINGLETON_ID);
    expect(data.isVisible).toBe(true);
    expect(typeof data.admissionYear).toBe('string');
  });

  it('update ensures the singleton exists before patching', async () => {
    prisma.heroSections.findUnique.mockResolvedValue(hero());
    prisma.heroSections.update.mockResolvedValue(hero({ isVisible: false }));

    await service.update({ isVisible: false });

    expect(prisma.heroSections.update).toHaveBeenCalledWith({
      where: { id: SINGLETON_ID },
      data: { isVisible: false },
    });
  });
});
