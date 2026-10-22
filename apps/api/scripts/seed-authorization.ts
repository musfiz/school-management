/**
 * Seed the authorization layer (hybrid RBAC + user-level menu permissions).
 *
 * Seeds:
 *   - Default system menus (slug-based, hierarchical).
 *   - Role default permission templates per role (SUPERADMIN gets all).
 *   - The single `SUPERADMIN` account (`is_super_admin = true`).
 *
 * Idempotent: keyed by slug / email, re-running never duplicates.
 *
 * Run: `ts-node -T -r tsconfig-paths/register scripts/seed-authorization.ts`
 *   (set SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD env to override)
 */
import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@school.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';

/** Default system menus keyed by slug. Parents are inserted before children. */
const MENUS = [
  { slug: 'dashboard', title: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', sortOrder: 1 },
  { slug: 'students', title: 'Students', path: '/students', icon: 'Users', sortOrder: 2 },
  { slug: 'teachers', title: 'Teachers', path: '/teachers', icon: 'User', sortOrder: 3 },
  { slug: 'accounting', title: 'Accounting', path: '/accounting', icon: 'Banknote', sortOrder: 4 },
  { slug: 'fees', title: 'Fee Management', path: '/fees', icon: 'CreditCard', sortOrder: 5, parentSlug: 'accounting' },
  { slug: 'payroll', title: 'Payroll', path: '/payroll', icon: 'FileText', sortOrder: 6, parentSlug: 'accounting' },
  { slug: 'reports', title: 'Reports', path: '/reports', icon: 'BarChart3', sortOrder: 7 },
  { slug: 'users', title: 'Users', path: '/users', icon: 'UserCog', sortOrder: 8 },
  { slug: 'permission_management', title: 'Permission Management', path: '/permissions', icon: 'ShieldCheck', sortOrder: 9 },
  { slug: 'settings', title: 'Settings', path: '/settings', icon: 'Settings', sortOrder: 10 },
];

/** Role default templates: role → list of {menuSlug, actions}. */
const ROLE_DEFAULTS: Record<string, { menuSlug: string; actions: ('canView' | 'canCreate' | 'canEdit' | 'canDelete')[] }[]> = {
  superadmin: MENUS.map((m) => ({ menuSlug: m.slug, actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] as const })),
  admin: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'students', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'teachers', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'accounting', actions: ['canView'] },
    { menuSlug: 'fees', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'payroll', actions: ['canView', 'canEdit'] },
    { menuSlug: 'reports', actions: ['canView'] },
    { menuSlug: 'users', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'permission_management', actions: ['canView', 'canEdit'] },
    { menuSlug: 'settings', actions: ['canView'] },
  ],
  management: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'students', actions: ['canView'] },
    { menuSlug: 'teachers', actions: ['canView'] },
    { menuSlug: 'accounting', actions: ['canView'] },
    { menuSlug: 'fees', actions: ['canView', 'canEdit'] },
    { menuSlug: 'payroll', actions: ['canView'] },
    { menuSlug: 'reports', actions: ['canView'] },
    { menuSlug: 'settings', actions: ['canView'] },
  ],
  accountant: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'accounting', actions: ['canView'] },
    { menuSlug: 'fees', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'payroll', actions: ['canView'] },
    { menuSlug: 'reports', actions: ['canView'] },
  ],
  teacher: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'students', actions: ['canView'] },
    { menuSlug: 'reports', actions: ['canView'] },
  ],
  student: [
    { menuSlug: 'dashboard', actions: ['canView'] },
  ],
  guardian: [
    { menuSlug: 'dashboard', actions: ['canView'] },
  ],
  exam_controller: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'reports', actions: ['canView', 'canEdit'] },
  ],
};

async function seedMenus(prisma: PrismaService): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // Insert roots first (no parent), then children.
  for (const m of MENUS.filter((x) => !x.parentSlug)) {
    const existing = await prisma.menu.findUnique({ where: { slug: m.slug } });
    if (existing) {
      map.set(m.slug, existing.id);
      console.log(`[seed-authorization] menu exists: ${m.slug}`);
      continue;
    }
    const row = await prisma.menu.create({
      data: { title: m.title, slug: m.slug, path: m.path, icon: m.icon ?? null, sortOrder: m.sortOrder },
    });
    map.set(m.slug, row.id);
    console.log(`[seed-authorization] created menu: ${m.slug}`);
  }
  for (const m of MENUS.filter((x) => x.parentSlug)) {
    const parentId = map.get(m.parentSlug!);
    if (!parentId) throw new Error(`Parent menu ${m.parentSlug} not found for ${m.slug}`);
    const existing = await prisma.menu.findUnique({ where: { slug: m.slug } });
    if (existing) {
      map.set(m.slug, existing.id);
      console.log(`[seed-authorization] menu exists: ${m.slug}`);
      continue;
    }
    const row = await prisma.menu.create({
      data: {
        title: m.title,
        slug: m.slug,
        path: m.path,
        icon: m.icon ?? null,
        sortOrder: m.sortOrder,
        parent: { connect: { id: parentId } },
      },
    });
    map.set(m.slug, row.id);
    console.log(`[seed-authorization] created menu: ${m.slug}`);
  }
  return map;
}

async function seedRoleDefaults(prisma: PrismaService, menuBySlug: Map<string, string>) {
  for (const [role, entries] of Object.entries(ROLE_DEFAULTS)) {
    for (const e of entries) {
      const menuId = menuBySlug.get(e.menuSlug);
      if (!menuId) {
        console.warn(`[seed-authorization] menu ${e.menuSlug} missing for role ${role}, skipping`);
        continue;
      }
      const existing = await prisma.roleDefaultPermission.findFirst({
        where: { role: role as any, menuId },
      });
      if (existing) continue;
      await prisma.roleDefaultPermission.create({
        data: {
          role: role as any,
          menuId,
          canView: e.actions.includes('canView'),
          canCreate: e.actions.includes('canCreate'),
          canEdit: e.actions.includes('canEdit'),
          canDelete: e.actions.includes('canDelete'),
        },
      });
    }
    console.log(`[seed-authorization] role defaults seeded: ${role}`);
  }
}

async function seedSuperAdmin(prisma: PrismaService) {
  const existing = await prisma.users.findUnique({ where: { email: SUPERADMIN_EMAIL } });
  if (existing) {
    console.log(`[seed-authorization] superadmin exists: ${SUPERADMIN_EMAIL}`);
    return existing;
  }
  const user = await prisma.users.create({
    data: {
      name: 'Super Admin',
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD, // hashed centrally by the Prisma extension
      role: 'superadmin',
      isSuperAdmin: true,
      isActive: true,
      isVerified: true,
    },
  });
  console.log(
    `[seed-authorization] created superadmin: ${SUPERADMIN_EMAIL} (password: ${SUPERADMIN_PASSWORD})`,
  );
  return user;
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    const menuBySlug = await seedMenus(prisma);
    await seedRoleDefaults(prisma, menuBySlug);
    await seedSuperAdmin(prisma);
    console.log('[seed-authorization] done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-authorization] FAILED:', err);
  process.exit(1);
});
