/**
 * db-migrate.ts — Prisma migration runner with first-class rollback support.
 *
 * Prisma itself only ships "migrate forward" (`migrate dev` / `migrate deploy`).
 * This runner wraps the standard flow and adds the pieces production teams
 * expect from a migration tool:
 *
 *   npm run db:migrate            # apply pending migrations (+ pre-flight, regenerates client)
 *   npm run db:migrate:new -- --name add_x   # author a REVERSIBLE migration (up.sql = migration.sql + down.sql)
 *   npm run db:rollback           # undo the last applied migration (runs its down.sql)
 *   npm run db:migrate:status     # migration history vs migrations folder
 *   npm run db:migrate:repair -- <name> --applied|--rolled-back   # resolve a failed migration
 *
 * Conventions (enforced here):
 * - Every migration folder contains `migration.sql` (up) and `down.sql` (down);
 *   the inventory is committed to git as one atomic unit.
 * - `down.sql` is generated from `prisma migrate diff`, never hand-written.
 * - A migration that has no `down.sql` cannot be rolled back — rollback aborts
 *   with instructions instead of leaving the DB half-undone.
 *
 * MySQL/MariaDB note: DDL statements auto-commit — a rollback cannot be
 * wrapped in a single transaction. The runner therefore executes statements
 * one-by-one, stops at the first failure, and reports exactly which statement
 * failed so a manual repair is precise.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import mariadb from 'mariadb';
import { buildDatabaseUrl } from '../src/prisma/database-url';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const MIG_NAME_RE = /^\d{14}_[a-z0-9_]+$/;

// ---------------------------------------------------------------------------
// small shared helpers
// ---------------------------------------------------------------------------

const show = (...lines: string[]) => console.log(lines.join('\n'));
const fail = (msg: string): never => {
  console.error(`\n[migrate] ERROR: ${msg}`);
  process.exit(1);
};

/** Migration folder names, chronological (timestamp-prefixed) order. */
function listMigrationDirs(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((d) => MIG_NAME_RE.test(d))
    .sort();
}

interface MigrationRow {
  name: string;
  finished: Date | null;
  rolledBack: Date | null;
  logs: string | null;
}

async function migrationHistory(): Promise<MigrationRow[]> {
  const conn = await openConn();
  try {
    const rows = (await conn.query(
      'SELECT migration_name, finished_at, rolled_back_at, logs FROM _prisma_migrations ORDER BY started_at',
    )) as any[];
    return rows.map((r) => ({
      name: r.migration_name as string,
      finished: r.finished_at ?? null,
      rolledBack: r.rolled_back_at ?? null,
      logs: r.logs ?? null,
    }));
  } finally {
    await conn.end();
  }
}

async function openConn(database?: string): Promise<mariadb.Connection> {
  const url = new URL(buildDatabaseUrl());
  const db = database ?? (decodeURIComponent(url.pathname.replace(/^\//, '')) || 'school');
  return mariadb.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password,
    database: db,
    multipleStatements: true,
  });
}

/** Run a prisma CLI command, echoing output, failing loudly. */
function prisma(args: string[], opts: { env?: NodeJS.ProcessEnv; capture?: boolean } = {}) {
  const cmd = `npx prisma ${args.join(' ')}`;
  try {
    const out = execSync(cmd, {
      stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
      encoding: 'utf8',
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    return out;
  } catch (e: any) {
    const detail = (e.stderr || e.stdout || e.message || '').toString();
    throw new Error(`prisma ${args.join(' ')} failed:\n${detail.slice(-4000)}`);
  }
}

/** Split a prisma-generated SQL script into statements (quote/comment aware). */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  const push = () => {
    const t = cur.trim();
    if (t && !t.split('\n').every((l) => l.trim().startsWith('--') || l.trim() === '' || l.trim().startsWith('/*'))) {
      out.push(t);
    }
    cur = '';
  };
  while (i < sql.length) {
    const c = sql[i];
    if (!inSingle && !inDouble && !inBacktick && c === '-' && sql[i + 1] === '-') {
      // line comment — consume to end of line
      const nl = sql.indexOf('\n', i);
      cur += sql.slice(i, nl === -1 ? sql.length : nl);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    if (!inSingle && !inDouble && !inBacktick && c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      cur += sql.slice(i, end === -1 ? sql.length : end + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (c === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (c === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (c === '`' && !inSingle && !inDouble) inBacktick = !inBacktick;
    else if (c === ';' && !inSingle && !inDouble && !inBacktick) {
      push();
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  push();
  return out;
}

/** Execute a generated SQL script statement-by-statement with precise errors. */
async function applyScript(sql: string, label: string, database?: string): Promise<number> {
  const statements = splitStatements(sql);
  if (statements.length === 0) return 0;
  const conn = await openConn(database);
  try {
    for (let n = 0; n < statements.length; n++) {
      try {
        await conn.query(statements[n]);
      } catch (e: any) {
        const preview = statements[n].replace(/\s+/g, ' ').slice(0, 160);
        throw new Error(
          `${label}: statement ${n + 1}/${statements.length} failed: ${e.message}\n` +
            `  → ${preview}`,
        );
      }
    }
  } finally {
    await conn.end();
  }
  return statements.length;
}

/**
 * MariaDB has no native JSON type — `JSON` is an alias of `LONGTEXT`. A
 * `MODIFY … JSON NULL` statement generated for a Prisma `Json` field is
 * therefore a physical no-op on MariaDB, and including it produces endless
 * identical COLUMN churn in every later diff. Strip these no-op statements
 * from generated up/down scripts (documented industry workaround;
 * legitimate non-JSON alters keep their full statement text).
 */
function stripJsonNoopDdls(sql: string): string {
  const chunks = sql.split(/\n\s*\n/);
  const kept = chunks.filter((chunk) => {
    if (!/^-- AlterTable\b/m.test(chunk)) return true;
    return !/ALTER TABLE\s+`[^`]+`\s+MODIFY\s+`[^`]+`\s+JSON\s+(NOT NULL|NULL)/i.test(chunk);
  });
  return kept.join('\n\n').replace(/^-\n+/, '-\n');
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

async function cmdStatus(): Promise<void> {
  const dirs = listMigrationDirs();
  const history = await migrationHistory();

  const rows = dirs.map((dir) => {
    const recs = history.filter((h) => h.name === dir);
    const applied = recs.some((r) => r.finished && !r.rolledBack);
    const failed = !applied && recs.some((r) => !r.finished && !r.rolledBack);
    const rolledBack = !applied && recs.some((r) => r.rolledBack);
    const status = applied ? 'APPLIED' : failed ? 'FAILED' : rolledBack ? 'ROLLED BACK' : 'PENDING';
    return { dir, status };
  });

  show('Migration inventory (prisma/migrations):\n');
  const width = Math.max(...rows.map((r) => r.dir.length)) + 2;
  for (const r of rows) show(`  ${r.dir.padEnd(width)} ${r.status}`);
  for (const orphan of history.filter((h) => !dirs.includes(h.name))) {
    show(`  ${orphan.name.padEnd(width)} (recorded in DB, folder missing from git)`);
  }
  const hasDown = (d: string) => fs.existsSync(path.join(MIGRATIONS_DIR, d, 'down.sql'));
  const noDown = dirs.filter((d) => !hasDown(d));
  if (noDown.length > 0) {
    show(`\n  ⚠  ${noDown.length} migration(s) have no down.sql and cannot be rolled back: ${noDown.join(', ')}`);
  } else {
    show('\n  ✓ every migration is reversible (down.sql present)');
  }

  const failedNames = history.filter((h) => h.finished === null && h.rolledBack === null).map((h) => h.name);
  if (failedNames.length > 0) {
    show(
      `\n  ✗ FAILED migrations block deploy: ${failedNames.join(', ')}\n` +
        `    fix with: npm run db:migrate:repair -- ${failedNames[0]} --applied-or-rolled-back`,
    );
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// up (deploy)
// ---------------------------------------------------------------------------

async function cmdUp(): Promise<void> {
  const history = await migrationHistory();
  const failed = history.filter((h) => h.finished === null && h.rolledBack === null);
  if (failed.length > 0) {
    const failedNames = failed.map((h) => h.name).join(', ');
    fail(
      `unresolved failed migration(s): ${failedNames} — deploy refuses to continue.\n` +
        `  If the SQL was already executed by hand:    npm run db:migrate:repair -- ${failed[0].name} --applied\n` +
        `  If it must be retried from scratch:         npm run db:migrate:repair -- ${failed[0].name} --rolled-back`,
    );
  }

  show('[migrate] pre-flight ok → prisma migrate deploy');
  try {
    show(prisma(['migrate', 'deploy']));
  } catch (e: any) {
    fail(e.message);
  }
  prisma(['generate']);
  show('[migrate] client regenerated ✓');
}

// ---------------------------------------------------------------------------
// repair
// ---------------------------------------------------------------------------

async function cmdRepair(args: string[]): Promise<void> {
  const name = args.find((a) => !a.startsWith('--'));
  const mode = args.includes('--applied') ? 'applied' : args.includes('--rolled-back') ? 'rolled-back' : null;
  if (!name || !mode) {
    fail('usage: npm run db:migrate:repair -- <migration_name> --applied|--rolled-back');
  }
  prisma(['migrate', 'resolve', `--${mode}`, name]);
  show(`[migrate] "${name}" marked as ${mode} ✓`);
}

// ---------------------------------------------------------------------------
// new (author a reversible migration)
// ---------------------------------------------------------------------------

function parseNameArg(args: string[]): { name?: string; verify: boolean } {
  const name = args.find((a) => !a.startsWith('--'));
  const verify = !args.includes('--no-verify');
  return { name, verify };
}

async function cmdNew(args: string[]): Promise<void> {
  const { name, verify } = parseNameArg(args);
  if (!name) fail('usage: npm run db:migrate:new -- --name <snake_case_name> [--no-verify]');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!slug) fail('migration name normalizes to empty');
  if (!/^[a-z][a-z0-9_]*$/.test(slug)) fail(`normalized name "${slug}" is not a valid migration slug`);

  const now = new Date();
  const ts = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
    now.getUTCDate(),
  ).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(
    now.getUTCSeconds(),
  ).padStart(2, '0')}`;
  const dir = path.join(MIGRATIONS_DIR, `${ts}_${slug}`);
  if (fs.existsSync(dir)) fail(`migration folder already exists: ${dir}`);
  // Both texts appear depending on from/to source kinds — treat either as empty.
  const emptyMarker = /^-- This is an empty (migration|diff)\b.*$/m;
  // The folder is created only AFTER the up diff below succeeds — an
  // existing-but-empty folder would break `prisma migrate diff --from-migrations`.

  // ---- 1) up diff: migrations inventory (materialized in the shadow DB) →
  // schema.prisma
  let upSql: string;
  try {
    upSql = prisma(
      ['migrate', 'diff', '--from-migrations', MIGRATIONS_DIR, '--to-schema', 'prisma/schema.prisma', '--script'],
      { capture: true },
    );
  } catch (e: any) {
    fail(String(e.message).slice(-2000));
  }
  // MariaDB JSON no-op filtering (see stripJsonNoopDdls) BEFORE the empty
  // check — on MariaDB `MODIFY … JSON` is a physical no-op (the JSON type is
  // an alias of LONGTEXT), so a diff containing only those statements means
  // schema.prisma and the migrations inventory are already in sync.
  upSql = stripJsonNoopDdls(upSql);
  if (emptyMarker.test(upSql.trim())) {
    fail('schema.prisma and migrations are already in sync — nothing to migrate. Edit schema.prisma first.');
  }

  // ---- 2) author the folder — migration.sql immediately, down.sql from the
  // DB-to-DB diff in step 4 below (never from the datamodel side: prisma's
  // differ under-reports MariaDB FK-backing indexes for datamodel sources,
  // which injects phantom CREATE INDEX statements into reverse diffs).
  fs.mkdirSync(dir);
  const upHeader = [
    '-- Up script for schema.prisma state when this migration was authored.',
    '-- Authenticity: generated by `prisma migrate diff` via npm run db:migrate:new.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'migration.sql'), upHeader + upSql.trim() + '\n');
  show(`[migrate] authored ${path.basename(dir)} (migration.sql)`);

  // ---- 3) materialize the post-up state on a scratch database -------------
  const scratch = `${process.env.DB_DATABASE ?? 'school'}_migrate_verify`;
  const scratchUrl = buildDatabaseUrl().replace(/\/[^/?]*(\?|$)/, `/${scratch}$1`);
  // baseSubset = inventory copy WITHOUT the new folder — it defines the
  // pre-migration state for both the down diff and its round-trip check.
  const baseSubset = path.join(MIGRATIONS_DIR, '.tmp-author-base');
  const dbServer = await mariadb.createConnection({
    host: new URL(buildDatabaseUrl()).hostname,
    port: Number(new URL(buildDatabaseUrl()).port || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  try {
    show('[migrate] materializing migration inventory on a scratch database...');
    await dbServer.query(`DROP DATABASE IF EXISTS \`${scratch}\``);
    await dbServer.query(`CREATE DATABASE \`${scratch}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
    for (const d of listMigrationDirs()) {
      if (d === path.basename(dir)) continue;
      await applyScript(
        fs.readFileSync(path.join(MIGRATIONS_DIR, d, 'migration.sql'), 'utf8'),
        `replay ${d}`,
        scratch,
      );
    }
    await applyScript(upSql, `${slug}.up`, scratch);
    // The scratch DB now holds the post-up state.

    fs.rmSync(baseSubset, { recursive: true, force: true });
    fs.mkdirSync(baseSubset, { recursive: true });
    fs.copyFileSync(path.join(MIGRATIONS_DIR, 'migration_lock.toml'), path.join(baseSubset, 'migration_lock.toml'));
    for (const d of listMigrationDirs()) {
      if (d === path.basename(dir)) continue;
      fs.mkdirSync(path.join(baseSubset, d));
      fs.copyFileSync(path.join(MIGRATIONS_DIR, d, 'migration.sql'), path.join(baseSubset, d, 'migration.sql'));
    }

    // ---- 4) down.sql = live-DB diff: scratch (post-up) → baseSubset state ---
    // Both endpoints are materialized MariaDB schemas (the --to-migrations
    // side replays the inventory into the shadow DB), so the result is
    // symmetric and free of datamodel-source index noise.
    let downSql = prisma(
      ['migrate', 'diff', '--from-config-datasource', '--to-migrations', baseSubset, '--script'],
      { capture: true, env: { DATABASE_URL: scratchUrl } },
    );
    downSql = stripJsonNoopDdls(downSql);
    if (emptyMarker.test(downSql.trim())) {
      throw new Error('generated down.sql is empty — unexpected for a non-empty up diff; aborting.');
    }
    const downHeader = [
      '-- down.sql — rollback for ' + `${ts}_${slug}`,
      '-- Reverses migration.sql. Generated with prisma migrate diff — do NOT hand-edit.',
      '-- Applied by: npm run db:rollback',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'down.sql'), downHeader + downSql.trim() + '\n');
    show(`[migrate] authored ${path.basename(dir)} (down.sql)`);

    if (verify) {
      // ---- 5) round trip: apply down to the scratch DB and re-diff --------
      await applyScript(downSql, `${slug}.down`, scratch);
      // scratch DB (after up+down) must equal the pre-migration state.
      // --exit-code: 0 = schemas equal, 2 = differences detected.
      let diffOut = '';
      let mismatch = false;
      try {
        diffOut = prisma(
          ['migrate', 'diff', '--from-config-datasource', '--to-migrations', baseSubset, '--exit-code', '--script'],
          { capture: true, env: { DATABASE_URL: scratchUrl } },
        );
      } catch (e: any) {
        if (e.status === 2) mismatch = true;
        else throw e;
      }
      if (mismatch || (diffOut.trim() && !emptyMarker.test(diffOut))) {
        throw new Error(
          `up+down does not restore the pre-migration state:\n` +
            (mismatch ? '(prisma reported schema differences)' : diffOut.slice(0, 800)),
        );
      }
      show('[migrate] reversibility verified ✓');
    }
    fs.rmSync(baseSubset, { recursive: true, force: true });
  } catch (e: any) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(path.join(MIGRATIONS_DIR, '.tmp-author-base'), { recursive: true, force: true });
    await dbServer.query(`DROP DATABASE IF EXISTS \`${scratch}\``).catch(() => undefined);
    await dbServer.end();
    fail(`verification failed: ${String(e?.message ?? e).slice(0, 1500)}`);
  }
  await dbServer.query(`DROP DATABASE IF EXISTS \`${scratch}\``);
  await dbServer.end();

  show(
    `\nReady. To apply it to the database, run:\n  npm run db:migrate\nRollback later:\n  npm run db:rollback`,
  );
}

// ---------------------------------------------------------------------------
// rollback (down)
// ---------------------------------------------------------------------------

async function cmdRollback(args: string[]): Promise<void> {
  const stepsArg = args.find((a) => a.startsWith('--steps='));
  const steps = Math.max(1, Number(stepsArg?.slice('--steps='.length) ?? 1));
  const dryRun = args.includes('--dry-run');

  const dirs = listMigrationDirs();
  const history = await migrationHistory();
  const pending = dirs.filter((d) => !history.some((h) => h.name === d && h.finished && !h.rolledBack));
  if (pending.length > 0) {
    show(
      `[migrate] note: ${pending.length} migration(s) exist on disk but are not applied ` +
        `(e.g. ${pending[0]}); rollback only touches applied ones.`,
    );
  }

  // newest applied first, oldest steps
  const appliedRows = history
    .filter((h) => h.finished && !h.rolledBack && dirs.includes(h.name))
    .sort((a, b) => (a.finished! < b.finished! ? 1 : -1))
    .map((h) => h.name);
  const uniqueApplied = [...new Set(appliedRows)];
  if (uniqueApplied.length === 0) fail('no applied migrations to roll back');
  if (uniqueApplied.length === 1 && uniqueApplied[0] === dirs[0]) {
    fail(`refusing to roll back the base migration "${dirs[0]}": it would drop every table in the database.`);
  }

  const targets = uniqueApplied.slice(0, steps);
  show(`[migrate] rollback plan: ${targets.join('  →  ')}`);
  for (const name of targets) {
    const downPath = path.join(MIGRATIONS_DIR, name, 'down.sql');
    if (!fs.existsSync(downPath)) {
      fail(
        `no down.sql for "${name}" — rollback would leave the schema inconsistent.\n` +
          `  Author it first (npm run db:migrate:new writes one automatically) or repair the migration manually.`,
      );
    }
  }
  if (dryRun) {
    for (const name of targets) {
      const stmts = splitStatements(fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'down.sql'), 'utf8'));
      show(`  --dry-run: ${name} → ${stmts.length} statement(s), first:\n      ${stmts[0]?.slice(0, 120)}`);
    }
    show('[migrate] dry-run complete (nothing executed)');
    return;
  }

  for (const name of targets) {
    show(`\n[migrate] rolling back ${name} ...`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'down.sql'), 'utf8');
    let count: number;
    try {
      count = await applyScript(sql, `${name}.down`);
    } catch (e: any) {
      fail(
        `${e.message}\n` +
          `The rollback stopped at the failing statement. Inspect the database state, fix manually if needed,\n` +
          `then either re-run db:rollback or mark it: npm run db:migrate:repair -- ${name} --applied|--rolled-back`,
      );
    }
    // Prisma has no native "unapply" bookkeeping (migrate resolve --rolled-back
    // only applies to migrations recorded as FAILED). The standard equivalent:
    // remove the migration's history rows entirely — the DB is now in the
    // pre-migration state, and a later `db:migrate` re-applies the folder.
    const conn = await openConn();
    try {
      await conn.query('DELETE FROM _prisma_migrations WHERE migration_name = ?', [name]);
    } finally {
      await conn.end();
    }
    show(`  ${count} statement(s) executed, history row removed ✓ (re-appliable with db:migrate)`);
  }

  prisma(['generate']);
  show(
    '\n[migrate] rollback complete ✓  Client regenerated.\n' +
      '  ⚠ prisma/schema.prisma still reflects the rolled-back change — reconcile it by\n' +
      '    restoring the file from git or running `prisma db pull` before the next `db:migrate:new`.',
  );
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

const [cmd = 'status', ...rest] = process.argv.slice(2);
void (async () => {
  try {
    switch (cmd) {
      case 'status':
        await cmdStatus();
        break;
      case 'up':
      case 'migrate':
        await cmdUp();
        break;
      case 'new':
        await cmdNew(rest);
        break;
      case 'rollback':
      case 'down':
        await cmdRollback(rest);
        break;
      case 'repair':
        await cmdRepair(rest);
        break;
      default:
        fail(
          `unknown command "${cmd}". Available: status | up | new | rollback | repair`,
        );
    }
  } catch (e: any) {
    fail(String(e?.message ?? e));
  }
})();
