import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSetting } from '../database/entities/site-setting.entity';
import { UpdateSiteSettingDto } from './site-setting.dto';

const SINGLETON_ID = 1;

@Injectable()
export class SiteSettingsService {
  constructor(
    @InjectRepository(SiteSetting)
    private readonly repo: Repository<SiteSetting>,
  ) {}

  /** Returns the single settings row, creating it with defaults on first read. */
  async find(): Promise<SiteSetting> {
    const existing = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ id: SINGLETON_ID }));
  }

  /** Patches the singleton row with whatever fields were submitted. */
  async update(dto: UpdateSiteSettingDto): Promise<SiteSetting> {
    const current = await this.find();
    const merged = this.repo.merge(current, dto);
    return this.repo.save(merged);
  }
}
