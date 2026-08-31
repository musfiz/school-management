#!/usr/bin/env node
// Wraps `typeorm migration:generate` to produce Laravel-style
// `Y_m_d_His_description.ts` filenames. TypeORM tracks applied migrations by
// the numeric class name embedded inside the file (not the filename), so the
// file is simply renamed after generation — the class name is left untouched.
import { spawnSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import path from 'node:path';

const rawName = process.argv[2];
if (!rawName) {
  console.error('Usage: pnpm migration:make <description>');
  console.error('Example: pnpm migration:make create_users_table');
  process.exit(1);
}

const words = rawName
  .replace(/[-\s]+/g, '_')
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .split('_')
  .filter(Boolean);

const snakeCase = words.map((w) => w.toLowerCase()).join('_');
const pascalCase = words
  .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
  .join('');

const now = Date.now();
const d = new Date(now);
const pad = (n) => String(n).padStart(2, '0');
const timestampPrefix = `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

const root = process.cwd();
const apiDir = path.join(root, 'apps', 'api');
const isWindows = process.platform === 'win32';
const tsxBin = path.join(
  apiDir,
  'node_modules',
  '.bin',
  isWindows ? 'tsx.cmd' : 'tsx',
);
const tsxArgs = [
  './node_modules/typeorm/cli.js',
  'migration:generate',
  '-d',
  'src/database/data-source.ts',
  '-t',
  String(now),
  `src/database/migrations/${pascalCase}`,
];

// Windows .cmd shims require a shell; pass a single pre-quoted command string
// (rather than shell:true + args array) to avoid Node's unsafe-concatenation warning.
const result = isWindows
  ? spawnSync(`"${tsxBin}" ${tsxArgs.join(' ')}`, {
      cwd: apiDir,
      encoding: 'utf8',
      shell: true,
    })
  : spawnSync(tsxBin, tsxArgs, { cwd: apiDir, encoding: 'utf8' });

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// eslint-disable-next-line no-control-regex
const plainStdout = (result.stdout || '').replace(/\x1B\[[0-9;]*m/g, '');
const match = /Migration (.+) has been generated successfully/.exec(
  plainStdout,
);
if (!match) {
  console.error(
    '[migration:make] Could not detect the generated migration file (no schema changes to generate?).',
  );
  process.exit(1);
}

const generatedPath = match[1].trim();
const newPath = path.join(
  path.dirname(generatedPath),
  `${timestampPrefix}_${snakeCase}.ts`,
);

renameSync(generatedPath, newPath);
console.log(`[migration:make] Renamed to ${path.relative(root, newPath)}`);
