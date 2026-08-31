#!/usr/bin/env node
// Runs automatically after `pnpm install`: scaffolds local .env files and
// builds packages/shared-types so `pnpm dev` works immediately on a fresh clone.
import { existsSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const isWindows = process.platform === 'win32';

const envFiles = [
  ['.env.example', '.env'],
  ['apps/api/.env.example', 'apps/api/.env'],
  ['apps/web/.env.example', 'apps/web/.env'],
];

// Skip env scaffolding in CI — those environments provide their own secrets.
if (!process.env.CI) {
  for (const [example, target] of envFiles) {
    const examplePath = path.join(root, example);
    const targetPath = path.join(root, target);
    if (existsSync(examplePath) && !existsSync(targetPath)) {
      copyFileSync(examplePath, targetPath);
      console.log(
        `[postinstall] Created ${target} (edit it with real secrets)`,
      );
    }
  }
}

console.log('[postinstall] Building packages/shared-types...');
const turboBin = path.join(
  root,
  'node_modules',
  '.bin',
  isWindows ? 'turbo.cmd' : 'turbo',
);
const turboArgs = ['run', 'build', '--filter=shared-types'];

// Windows .cmd shims require a shell; pass a single pre-quoted command string
// (rather than shell:true + args array) to avoid Node's unsafe-concatenation warning.
const result = isWindows
  ? spawnSync(`"${turboBin}" ${turboArgs.join(' ')}`, {
      stdio: 'inherit',
      shell: true,
    })
  : spawnSync(turboBin, turboArgs, { stdio: 'inherit' });

if (result.status !== 0) {
  console.error(
    '[postinstall] Failed to build shared-types. Run `pnpm --filter shared-types build` manually.',
  );
  process.exit(result.status ?? 1);
}
