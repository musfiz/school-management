/**
 * Seeds the dashboard-managed homepage sections so a fresh install renders a
 * complete homepage instead of an empty one. Safe to re-run: each section is
 * matched by its `sectionKey`, and only missing keys are inserted. Items are
 * matched by `itemKey` + title, so editing copy in the dashboard is preserved.
 *
 * Run with: pnpm --filter api exec tsx src/database/seed-homepage.ts
 */
import { DataSource } from 'typeorm';
import { config } from '../config';
import { HomepageSection } from './entities/homepage-section.entity';
import { HomepageItem } from './entities/homepage-item.entity';

interface SeedItem {
  itemKey: string;
  titleEn?: string;
  titleBn?: string;
  subtitleEn?: string;
  subtitleBn?: string;
  bodyEn?: string;
  bodyBn?: string;
  icon?: string;
}

interface SeedSection {
  sectionKey: string;
  labelEn: string;
  labelBn?: string;
  eyebrowEn?: string;
  eyebrowBn?: string;
  titleEn?: string;
  titleBn?: string;
  bodyEn?: string;
  bodyBn?: string;
  ctaTextEn?: string;
  ctaTextBn?: string;
  ctaHref?: string;
  background: 'white' | 'muted' | 'navy';
  sortOrder: number;
  items: SeedItem[];
}

const sections: SeedSection[] = [
  {
    sectionKey: 'values',
    labelEn: 'Our Values',
    labelBn: 'আমাদের মূল্যবোধ',
    eyebrowEn: 'What we stand for',
    eyebrowBn: 'আমরা যা প্রতিষ্ঠা করি',
    titleEn: 'Knowledge. Discipline. Excellence.',
    titleBn: 'জ্ঞান। শৃঙ্খলা। উৎকর্ষ।',
    background: 'navy',
    sortOrder: 1,
    items: [
      {
        itemKey: 'value',
        titleEn: 'Knowledge',
        titleBn: 'জ্ঞান',
        subtitleEn: 'Curiosity first — we teach students how to learn, not just what to memorise.',
        subtitleBn: 'জ্ঞানার্জনই প্রধান — শিক্ষার্থীদের কী মুখস্থ করবে নয়, কীভাবে শিখবে তা শেখানো হয়।',
        icon: 'book-open',
      },
      {
        itemKey: 'value',
        titleEn: 'Discipline',
        titleBn: 'শৃঙ্খলা',
        subtitleEn: 'A safe, respectful campus where every child is accountable for their conduct.',
        subtitleBn: 'নিরাপদ ও সম্মানজনক ক্যাম্পাস, যেখানে প্রতিটি শিক্ষার্থীর আচরণের দায়িত্ব রয়েছে।',
        icon: 'shield',
      },
      {
        itemKey: 'value',
        titleEn: 'Excellence',
        titleBn: 'উৎকর্ষ',
        subtitleEn: 'Small classes and committed teachers that help every student reach their best.',
        subtitleBn: 'ছোট ক্লাস ও নিবেদিত শিক্ষক, যারা প্রতিটি শিক্ষার্থীকে সেরা সম্ভব করে তোলে।',
        icon: 'sparkles',
      },
    ],
  },
  {
    sectionKey: 'about',
    labelEn: 'About School',
    labelBn: 'প্রতিষ্ঠান পরিচিতি',
    eyebrowEn: 'About us',
    eyebrowBn: 'আমাদের পরিচিতি',
    titleEn: 'A half-century of shaping bright futures',
    titleBn: 'অর্ধশতকেরও বেশি সময় ধরে সুন্দর ভবিষ্যৎ গড়ার প্রচেষ্টা',
    bodyEn:
      'Founded on the belief that every child deserves a safe place to learn and the encouragement to reach further, our school pairs academic rigour with the values of curiosity and service.',
    bodyBn:
      'প্রতিটি শিক্ষার্থীর শেখার নিরাপদ জায়গা এবং আরও এগোনোর প্রেরণা — এই বিশ্বাস থেকেই আমাদের প্রতিষ্ঠা। আমরা শিক্ষার কঠোরতার সঙ্গে জ্ঞানার্জন ও সেবার মূল্যবোধ মিলিয়ে চলি।',
    ctaTextEn: 'Learn our story',
    ctaTextBn: 'আমাদের পরিচয়',
    ctaHref: '/about/about-us',
    background: 'white',
    sortOrder: 2,
    items: [
      {
        itemKey: 'bullet',
        titleEn: 'Caring, experienced faculty for every subject',
        titleBn: 'প্রতিটি বিষয়ে যত্নশীল ও অভিজ্ঞ শিক্ষকমণ্ডলী',
      },
      {
        itemKey: 'bullet',
        titleEn: 'Modern labs, library and a safe campus',
        titleBn: 'আধুনিক ল্যাব, লাইব্রেরি ও নিরাপদ ক্যাম্পাস',
      },
      {
        itemKey: 'bullet',
        titleEn: 'Free tuition with support for those who need it',
        titleBn: 'যারা প্রয়োজন তাদের জন্য বিনামূল্যে বৃত্তি ও সহায়তা',
      },
      { itemKey: 'stat', titleEn: '2,400+', subtitleEn: 'Students', titleBn: '২,৪০০+', subtitleBn: 'শিক্ষার্থী' },
      { itemKey: 'stat', titleEn: '96', subtitleEn: 'Teachers', titleBn: '৯৬', subtitleBn: 'শিক্ষক' },
      { itemKey: 'stat', titleEn: '12k+', subtitleEn: 'Library books', titleBn: '১২ হাজার+', subtitleBn: 'লাইব্রেরি বই' },
      { itemKey: 'stat', titleEn: '98%', subtitleEn: 'Pass rate', titleBn: '৯৮%', subtitleBn: 'পাসের হার' },
    ],
  },
];

async function seedHomepage() {
  console.log('🌱 Seeding homepage sections...\n');

  const dataSource = new DataSource({
    type: 'mysql',
    host: config().database.host,
    port: config().database.port,
    username: config().database.username,
    password: config().database.password,
    database: config().database.database,
    entities: [HomepageSection, HomepageItem],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  console.log('✅ Database connected\n');

  const sectionRepo = dataSource.getRepository(HomepageSection);
  const itemRepo = dataSource.getRepository(HomepageItem);

  for (const seed of sections) {
    let section = await sectionRepo.findOne({ where: { sectionKey: seed.sectionKey } });
    const isNew = !section;

    if (isNew) {
      // `items` lives on SeedSection for readability but is a separate table,
      // so strip it before handing the rest to the entity.
      const { items: _items, ...fields } = seed;
      section = await sectionRepo.save(sectionRepo.create(fields));
      console.log(`➕ Created section "${seed.sectionKey}"`);
    } else {
      console.log(`↩️  Section "${seed.sectionKey}" already exists — leaving content untouched`);
    }

    const existingItems = await itemRepo.find({ where: { sectionId: section.id } });
    for (const [index, seedItem] of seed.items.entries()) {
      const already = existingItems.some((row) => row.itemKey === seedItem.itemKey && row.titleEn === seedItem.titleEn);
      if (already) continue;
      await itemRepo.save(itemRepo.create({ ...seedItem, sectionId: section.id, sortOrder: index + 1 }));
      console.log(`   ➕ Added ${seedItem.itemKey} item "${seedItem.titleEn ?? ''}"`);
    }
  }

  const sectionCount = await sectionRepo.count();
  const itemCount = await itemRepo.count();
  console.log(`\n✅ Done. ${sectionCount} sections, ${itemCount} items.\n`);

  await dataSource.destroy();
}

seedHomepage().catch((error) => {
  console.error('❌ Homepage seed failed:', error);
  process.exit(1);
});