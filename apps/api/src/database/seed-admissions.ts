import { DataSource, type DataSourceOptions } from 'typeorm';
import { config } from '../config';
import { dataSourceOptions } from './data-source';
import { WaiverPresetRule } from './entities/waiver-preset-rule.entity';
import { DEFAULT_WAIVER_PRESETS } from '../admissions/waiver-calculator.service';

// NOTE: schema is owned by migrations — never synchronize here (a partial
// entity list + synchronize mangles foreign keys on migrated databases).
const dataSource = new DataSource({
  ...dataSourceOptions,
  database: config().database.database,
  synchronize: false,
  logging: false,
} as DataSourceOptions);

/**
 * Phase 1 — admission config seeder (Plan Phase 1).
 * Idempotent: inserts the standard waiver-preset catalogue (Workflow 2)
 * keyed by rule_code; re-runs only report counts.
 */
async function seed() {
  console.log('🌱 Starting admissions config seed...\n');
  await dataSource.initialize();
  console.log('✅ Database connected\n');

  const repo = dataSource.getRepository(WaiverPresetRule);
  let created = 0;
  let skipped = 0;
  for (const d of DEFAULT_WAIVER_PRESETS) {
    const existing = await repo.findOne({ where: { ruleCode: d.ruleCode } });
    if (existing) {
      skipped += 1;
      continue;
    }
    await repo.save(
      repo.create({
        ruleCode: d.ruleCode,
        ruleName: d.ruleName,
        institutionType: d.institutionType ?? null,
        minGpa: d.minGpa ?? null,
        maxGpa: d.maxGpa ?? null,
        quotaTag: d.quotaTag ?? null,
        residenceType: d.residenceType ?? null,
        waiverType: d.waiverType,
        admissionFeePct: d.admissionFeePct,
        tuitionFeePct: d.tuitionFeePct,
        requiresZakatEligible: d.requiresZakatEligible ?? false,
        priority: d.priority,
        isActive: true,
        remark: d.remark ?? null,
      }),
    );
    created += 1;
    console.log(`  + preset ${d.ruleCode}`);
  }
  console.log(`\n✅ Admissions seed done — ${created} created, ${skipped} already present`);
  await dataSource.destroy();
}

seed().catch(async (e) => {
  console.error('❌ Admissions seed failed:', e instanceof Error ? e.message : e);
  try {
    await dataSource.destroy();
  } catch {
    /* already closed */
  }
  process.exit(1);
});
