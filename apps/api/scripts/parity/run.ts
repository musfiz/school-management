/**
 * Parity harness runner (docs/PRISMA_MIGRATION_PLAN.md §9).
 *
 *   pnpm --filter api parity --record [--file <name>]   # capture golden
 *   pnpm --filter api parity [--file <name>]            # compare vs golden
 *
 * The runner boots the Nest DI container (via ts-node, which emits the
 * decorator metadata that esbuild/tsx cannot) so probes can call the *real*
 * service methods. The identical probe therefore runs against the TypeORM-backed
 * service before a wave and the Prisma-backed service after it, proving the
 * rewrite is behaviour-preserving.
 *
 * Exit code is non-zero when any probe differs, so it can gate a wave.
 */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { diff, normalize } from './json-diff';
import { probes } from './probes';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const record = process.argv.includes('--record');
  const name = argument('--file') ?? 'baseline';
  const goldenDir = join(__dirname, 'golden');
  const goldenPath = join(goldenDir, `${name}.json`);

  // Boot the whole app context (no HTTP listener): every module's providers,
  // including the Prisma client, are live.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const ctx = { app, prisma: app.get(PrismaService) };

    const snapshot: Record<string, unknown> = {};
    for (const probe of probes) {
      snapshot[probe.name] = normalize(await probe.run(ctx));
    }

    if (record) {
      if (!existsSync(goldenDir)) mkdirSync(goldenDir, { recursive: true });
      writeFileSync(goldenPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
      console.log(`[parity] recorded ${probes.length} probe(s) -> ${goldenPath}`);
      return;
    }

    if (!existsSync(goldenPath)) {
      throw new Error(`No golden file at ${goldenPath}. Run with --record first.`);
    }

    const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as Record<
      string,
      unknown
    >;

    let failures = 0;
    for (const probe of probes) {
      if (!(probe.name in golden)) {
        console.error(`[parity] MISSING golden for probe "${probe.name}"`);
        failures++;
        continue;
      }
      const differences = diff(
        golden[probe.name],
        snapshot[probe.name],
        `$.${probe.name}`,
      );
      if (differences.length > 0) {
        failures++;
        console.error(`[parity] MISMATCH in "${probe.name}":`);
        for (const d of differences.slice(0, 20)) {
          console.error(
            `  ${d.path}\n    expected: ${JSON.stringify(d.expected)}\n    actual:   ${JSON.stringify(d.actual)}`,
          );
        }
      }
    }

    if (failures > 0) {
      console.error(`[parity] FAILED — ${failures} probe(s) differ.`);
      process.exitCode = 1;
      return;
    }
    console.log(`[parity] OK — ${probes.length} probe(s) match ${name}.json`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[parity] ERROR:', err);
  process.exit(1);
});
