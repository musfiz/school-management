import {
  buildDatabaseUrl,
  buildMariaDbConnectionConfig,
  buildShadowDatabaseUrl,
  UTC_SESSION_SQL,
} from './database-url';

describe('buildDatabaseUrl', () => {
  it('prefers DATABASE_URL when set', () => {
    expect(
      buildDatabaseUrl({ DATABASE_URL: 'mysql://u:p@h:3306/custom' }),
    ).toBe('mysql://u:p@h:3306/custom');
  });

  it('derives a MySQL URL from the DB_* variables', () => {
    const url = buildDatabaseUrl({
      DB_USERNAME: 'root',
      DB_PASSWORD: 'secret',
      DB_HOST: 'db.internal',
      DB_PORT: '3307',
      DB_DATABASE: 'school',
    });
    expect(url).toBe('mysql://root:secret@db.internal:3307/school');
  });

  it('falls back to the documented defaults', () => {
    expect(buildDatabaseUrl({})).toBe('mysql://root:@localhost:3306/school');
  });

  it('percent-encodes credentials that need it', () => {
    const url = buildDatabaseUrl({
      DB_USERNAME: 'u ser',
      DB_PASSWORD: 'p@ss:word/with#chars',
      DB_HOST: 'localhost',
      DB_PORT: '3306',
      DB_DATABASE: 'school',
    });
    expect(url).toBe(
      'mysql://u%20ser:p%40ss%3Aword%2Fwith%23chars@localhost:3306/school',
    );
  });
});

describe('buildShadowDatabaseUrl', () => {
  it('prefers SHADOW_DATABASE_URL when set', () => {
    expect(
      buildShadowDatabaseUrl({ SHADOW_DATABASE_URL: 'mysql://u:p@h/s' }),
    ).toBe('mysql://u:p@h/s');
  });

  it('derives a <db>_shadow database on the same server', () => {
    const url = buildShadowDatabaseUrl({
      DB_HOST: 'localhost',
      DB_PORT: '3306',
      DB_DATABASE: 'school',
    });
    expect(url).toBe('mysql://root:@localhost:3306/school_shadow');
  });
});

describe('buildMariaDbConnectionConfig', () => {
  it('derives the pool config and pins the session to UTC', () => {
    const config = buildMariaDbConnectionConfig({
      DB_USERNAME: 'root',
      DB_PASSWORD: 'secret',
      DB_HOST: 'db.internal',
      DB_PORT: '3307',
      DB_DATABASE: 'school',
    });

    expect(config).toEqual({
      host: 'db.internal',
      port: 3307,
      user: 'root',
      password: 'secret',
      database: 'school',
      initSql: UTC_SESSION_SQL,
    });
    expect(UTC_SESSION_SQL).toBe("SET time_zone = '+00:00'");
  });

  it('honours DATABASE_URL over the DB_* variables', () => {
    const config = buildMariaDbConnectionConfig({
      DATABASE_URL: 'mysql://u:p@replica:3308/custom',
      DB_HOST: 'ignored',
    });
    expect(config.host).toBe('replica');
    expect(config.port).toBe(3308);
    expect(config.database).toBe('custom');
    expect(config.initSql).toBe(UTC_SESSION_SQL);
  });

  it('defaults the port and database like buildDatabaseUrl', () => {
    const config = buildMariaDbConnectionConfig({});
    expect(config.port).toBe(3306);
    expect(config.database).toBe('school');
    expect(config.password).toBeUndefined();
  });
});
