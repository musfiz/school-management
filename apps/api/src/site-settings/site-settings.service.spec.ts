import { SiteSettingsService } from './site-settings.service';
import { asPrisma, createPrismaMock, PrismaMock } from '../../test/support/prisma-mock';

const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

const settings = (over: Partial<Record<string, unknown>> = {}) => ({
  id: SINGLETON_ID,
  siteName: 'My School',
  siteNameBn: null,
  tagline: null,
  taglineBn: null,
  description: null,
  logoUrl: null,
  headerDisplay: 'both',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...over,
});

describe('SiteSettingsService', () => {
  let prisma: PrismaMock;
  let service: SiteSettingsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SiteSettingsService(asPrisma(prisma));
  });

  it('find returns the existing singleton, mapped to snake_case', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(settings());

    const row = await service.find();

    expect(prisma.siteSettings.findUnique).toHaveBeenCalledWith({
      where: { id: SINGLETON_ID },
    });
    expect(prisma.siteSettings.create).not.toHaveBeenCalled();
    expect(row.created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect('createdAt' in row).toBe(false);
  });

  it('find creates the singleton with defaults on first read', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(null);
    prisma.siteSettings.create.mockResolvedValue(settings());

    await service.find();

    expect(prisma.siteSettings.create).toHaveBeenCalledWith({
      data: { id: SINGLETON_ID },
    });
  });

  it('update ensures the row exists before patching it', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(settings());
    prisma.siteSettings.update.mockResolvedValue(settings({ siteName: 'New' }));

    const updated = await service.update({ siteName: 'New' });

    expect(prisma.siteSettings.update).toHaveBeenCalledWith({
      where: { id: SINGLETON_ID },
      data: { siteName: 'New' },
    });
    expect(updated.siteName).toBe('New');
  });

  it('update creates the singleton first when it is absent', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(null);
    prisma.siteSettings.create.mockResolvedValue(settings());
    prisma.siteSettings.update.mockResolvedValue(settings({ siteName: 'New' }));

    await service.update({ siteName: 'New' });

    expect(prisma.siteSettings.create).toHaveBeenCalledTimes(1);
    expect(prisma.siteSettings.update).toHaveBeenCalledTimes(1);
  });
});
