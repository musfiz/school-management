import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire } from '../prisma/wire';
import { UpdateSiteSettingDto } from './site-setting.dto';

const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the single settings row, creating it with defaults on first read. */
  async find() {
    const existing = await this.prisma.siteSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing) return toWire(existing);

    const created = await this.prisma.siteSettings.create({
      data: { id: SINGLETON_ID },
    });
    return toWire(created);
  }

  /** Patches the singleton row with whatever fields were submitted. */
  async update(dto: UpdateSiteSettingDto) {
    // Ensure the singleton exists before the UPDATE (matches the old
    // find-then-save flow, whose save() would otherwise INSERT).
    await this.find();
    const updated = await this.prisma.siteSettings.update({
      where: { id: SINGLETON_ID },
      data: { ...dto },
    });
    return toWire(updated);
  }
}
