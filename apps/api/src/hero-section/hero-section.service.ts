import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWire } from '../prisma/wire';
import { UpdateHeroSectionDto } from './hero-section.dto';

const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

const DEFAULT_HERO_SECTION = {
  id: SINGLETON_ID,
  isVisible: true,
  admissionYear: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
  tagline1: 'Building Tomorrow’s Leaders',
  tagline1Bn: 'ভবিষ্যতের নেতৃত্ব গড়ে তোলা',
  tagline2: 'Inspiring Excellence in Every Student',
  tagline2Bn: 'প্রতিটি শিক্ষার্থীর শ্রেষ্ঠত্ব বিকাশ',
  tagline3: 'Through Knowledge & Values',
  tagline3Bn: 'জ্ঞান ও মূল্যবোধের আলোয়',
  shortDescription:
    'Empowering students to achieve their full potential through rigorous academics, holistic development, and a vibrant learning community.',
  shortDescriptionBn:
    'কঠোর পাঠ্যক্রম, সামগ্রিক বিকাশ এবং একটি প্রাণবন্ত শিক্ষার পরিবেশের মাধ্যমে শিক্ষার্থীদের সম্ভাবনাকে বিকশিত করা।',
  showApplyButton: true,
  instituteOpenInfo: 'Open house: Sep 19 · 10am',
  instituteOpenInfoBn: 'খোলা থাকার সময়: রবি - বৃহস্পতি সকাল ৯টা - বিকাল ৪টা',
  phone: '+880 1700-000000',
};

@Injectable()
export class HeroSectionService {
  constructor(private readonly prisma: PrismaService) {}

  async find() {
    const row = await this.prisma.heroSections.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (row) return toWire(row);

    const created = await this.prisma.heroSections.create({
      data: DEFAULT_HERO_SECTION,
    });
    return toWire(created);
  }

  async update(dto: UpdateHeroSectionDto) {
    await this.find(); // ensure the singleton exists first
    const updated = await this.prisma.heroSections.update({
      where: { id: SINGLETON_ID },
      data: { ...dto },
    });
    return toWire(updated);
  }
}
