import * as fs from 'fs';
import * as path from 'path';
import { MENUS, ROLE_DEFAULTS } from '../scripts/seed-authorization';

describe('Nav Menu Drift Check', () => {
  it('every parentSlug in MENUS points to a valid root menu', () => {
    const slugs = new Set(MENUS.map((m) => m.slug));
    for (const m of MENUS) {
      if (m.parentSlug) {
        expect(slugs.has(m.parentSlug)).toBe(true);
      }
    }
  });

  it('every slug in MENUS is unique', () => {
    const slugs = MENUS.map((m) => m.slug);
    const uniqueSlugs = new Set(slugs);
    expect(slugs.length).toBe(uniqueSlugs.size);
  });

  it('all ROLE_DEFAULTS reference slugs defined in MENUS', () => {
    const slugs = new Set(MENUS.map((m) => m.slug));
    for (const [role, entries] of Object.entries(ROLE_DEFAULTS)) {
      for (const e of entries) {
        expect(slugs.has(e.menuSlug)).toBe(true);
      }
    }
  });

  it('every menuSlug in nav-config.ts exists in seed MENUS', () => {
    const navConfigPath = path.resolve(
      __dirname,
      '../../web/src/lib/nav-config.ts',
    );
    const content = fs.readFileSync(navConfigPath, 'utf8');

    // Extract all menuSlug: "..."
    const matches = content.matchAll(/menuSlug:\s*"([^"]+)"/g);
    const navSlugs = new Set<string>();
    for (const m of matches) {
      navSlugs.add(m[1]);
    }

    expect(navSlugs.size).toBeGreaterThan(0);

    const seededSlugs = new Set(MENUS.map((m) => m.slug));
    const missing: string[] = [];
    for (const slug of navSlugs) {
      if (!seededSlugs.has(slug)) {
        missing.push(slug);
      }
    }

    expect(missing).toEqual([]);
  });
});
