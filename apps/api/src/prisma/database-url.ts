/**
 * Database URL helpers shared by the Prisma client, the smoke check and tests.
 *
 * During the strangle migration Prisma and TypeORM point at the same database,
 * so Prisma derives its connection string from the existing `DB_*` variables
 * (docs/PRISMA_MIGRATION_PLAN.md AD-P10). `DATABASE_URL`, when set, wins.
 */

export function buildDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const user = encodeURIComponent(env.DB_USERNAME ?? 'root');
  const password = encodeURIComponent(env.DB_PASSWORD ?? '');
  const host = env.DB_HOST ?? 'localhost';
  const port = env.DB_PORT ?? '3306';
  const database = env.DB_DATABASE ?? 'school';

  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * Pins every Prisma database session to UTC.
 *
 * The `@prisma/adapter-mariadb` driver reads columns with `dateStrings: true`
 * and then re-attaches a UTC designator to `TIMESTAMP`/`DATETIME` values
 * (`new Date(value + "Z")`). That is only correct when the server hands the
 * value back in UTC. Left at the server default (here `Asia/Dhaka`, +06:00) the
 * adapter produced timestamps shifted by the session offset, while TypeORM's
 * mysql2 driver (which interprets the server-local string as local time)
 * produced the correct instant. Running `SET time_zone = '+00:00'` on each
 * connection aligns them: both ORMs now return the same `Date` for the same
 * stored value (docs/PRISMA_MIGRATION_PLAN.md, Wave 1).
 */
export const UTC_SESSION_SQL = "SET time_zone = '+00:00'";

/** Connection settings for `@prisma/adapter-mariadb` when the adapter builds
 *  its own pool (as opposed to being handed a pool). */
export interface MariaDbConnectionConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  database: string;
  initSql: string;
}

/**
 * Builds the Prisma driver-adapter pool config from the same `DB_*` /
 * `DATABASE_URL` inputs as `buildDatabaseUrl`, plus the UTC session pin.
 */
export function buildMariaDbConnectionConfig(
  env: NodeJS.ProcessEnv = process.env,
): MariaDbConnectionConfig {
  const url = new URL(buildDatabaseUrl(env));
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'school',
    initSql: UTC_SESSION_SQL,
  };
}

/**
 * Prisma Migrate needs a shadow database for `migrate dev` and for
 * `migrate diff --from-migrations`. Default to `<db>_shadow` on the same
 * server; override with `SHADOW_DATABASE_URL` when the DB user cannot create
 * databases.
 */
export function buildShadowDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.SHADOW_DATABASE_URL) return env.SHADOW_DATABASE_URL;

  const shadowDatabase = `${env.DB_DATABASE ?? 'school'}_shadow`;

  // `mysql:` is not a WHATWG "special" scheme, so `new URL()` would normalise
  // an empty password away. Replace the path segment textually instead.
  if (env.DATABASE_URL) {
    return env.DATABASE_URL.replace(/\/[^/?]*(\?|$)/, `/${shadowDatabase}$1`);
  }

  const user = encodeURIComponent(env.DB_USERNAME ?? 'root');
  const password = encodeURIComponent(env.DB_PASSWORD ?? '');
  const host = env.DB_HOST ?? 'localhost';
  const port = env.DB_PORT ?? '3306';

  return `mysql://${user}:${password}@${host}:${port}/${shadowDatabase}`;
}
