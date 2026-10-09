import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeroSection } from '../database/entities/hero-section.entity';
import { UpdateHeroSectionDto } from './hero-section.dto';

const DEFAULT_HERO_SECTION: Partial<HeroSection> = {
  id: 1,
  isVisible: true,
  admissionYear: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
  tagline1: 'Building Tomorrow’s Leaders',
  tagline1Bn: 'ভবিষ্যতের নেতৃত্ব গড়ে তোলা',
  tagline2: 'Inspiring Excellence in Every Student',
  tagline2Bn: 'প্রতিটি শিক্ষার্থীর শ্রেষ্ঠত্ব বিকাশ',
  tagline3: 'Through Knowledge & Values',
  tagline3Bn: 'জ্ঞান ও মূল্যবোধের আলোয়',
  shortDescription: 'Empowering students to achieve their full potential through rigorous academics, holistic development, and a vibrant learning community.',
  shortDescriptionBn: 'কঠোর পাঠ্যক্রম, সামগ্রিক বিকাশ এবং একটি প্রাণবন্ত শিক্ষার পরিবেশের মাধ্যমে শিক্ষার্থীদের সম্ভাবনাকে বিকশিত করা।',
  showApplyButton: true,
  instituteOpenInfo: 'Open house: Sep 19 · 10am',
  instituteOpenInfoBn: 'খোলা থাকার সময়: রবি - বৃহস্পতি সকাল ৯টা - বিকাল ৪টা',
  phone: '+880 1700-000000',
};

@Injectable()
export class HeroSectionService {
  constructor(
    @InjectRepository(HeroSection)
    private readonly repo: Repository<HeroSection>,
  ) {}

  async find(): Promise<HeroSection> {
    let row = await this.repo.findOne({ where: { id: 1 } });
    if (!row) {
      row = this.repo.create(DEFAULT_HERO_SECTION);
      await this.repo.save(row);
    }
    return row;
  }

  async update(dto: UpdateHeroSectionDto): Promise<HeroSection> {
    const existing = await this.find();
    const updated = this.repo.merge(existing, dto, { id: 1 });
    return this.repo.save(updated);
  }
}
