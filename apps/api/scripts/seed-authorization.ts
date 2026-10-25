/**
 * Seed the authorization layer (hybrid RBAC + user-level menu permissions).
 *
 * Seeds:
 *   - Default system menus (slug-based, hierarchical).
 *   - Role default permission templates per role (SUPERADMIN gets all).
 *   - The first-login default accounts, one per core role (`superadmin`,
 *     `admin`, `accountant`, `management`), so a fresh DB migration always has
 *     a working login for each role out of the box.
 *
 * Idempotent: keyed by slug / email, re-running never duplicates.
 *
 * Run: `ts-node -T -r tsconfig-paths/register scripts/seed-authorization.ts`
 *   (set <ROLE>_EMAIL / <ROLE>_PASSWORD env vars, e.g. SUPERADMIN_EMAIL /
 *   SUPERADMIN_PASSWORD, ADMIN_EMAIL / ADMIN_PASSWORD, ACCOUNTANT_EMAIL /
 *   ACCOUNTANT_PASSWORD, MANAGEMENT_EMAIL / MANAGEMENT_PASSWORD, to override)
 */
import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';

export interface DefaultUserDef {
  role: 'superadmin' | 'admin' | 'accountant' | 'management';
  name: string;
  emailEnvVar: string;
  passwordEnvVar: string;
  defaultEmail: string;
  defaultPassword: string;
  isSuperAdmin?: boolean;
}

/** First-login default accounts, one per core role. Overridable via env vars. */
export const DEFAULT_USERS: DefaultUserDef[] = [
  {
    role: 'superadmin',
    name: 'Super Admin',
    emailEnvVar: 'SUPERADMIN_EMAIL',
    passwordEnvVar: 'SUPERADMIN_PASSWORD',
    defaultEmail: 'sadmin@school.com',
    defaultPassword: 'sadmin@365',
    isSuperAdmin: true,
  },
  {
    role: 'admin',
    name: 'Admin',
    emailEnvVar: 'ADMIN_EMAIL',
    passwordEnvVar: 'ADMIN_PASSWORD',
    defaultEmail: 'admin@school.com',
    defaultPassword: 'admin@365',
  },
  {
    role: 'accountant',
    name: 'Accountant',
    emailEnvVar: 'ACCOUNTANT_EMAIL',
    passwordEnvVar: 'ACCOUNTANT_PASSWORD',
    defaultEmail: 'accountant@school.com',
    defaultPassword: 'accountant@365',
  },
  {
    role: 'management',
    name: 'Management',
    emailEnvVar: 'MANAGEMENT_EMAIL',
    passwordEnvVar: 'MANAGEMENT_PASSWORD',
    defaultEmail: 'management@school.com',
    defaultPassword: 'management@365',
  },
];

export interface CustomActionDef {
  action: string;
  label: string;
}

export interface MenuActionsConfig {
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  custom?: CustomActionDef[];
}

export interface SeedMenuDef {
  slug: string;
  title: string;
  path: string;
  icon?: string;
  sortOrder: number;
  parentSlug?: string;
  actionsConfig?: MenuActionsConfig;
}

/** Default system menus keyed by slug. Parents are inserted before children. */
export const MENUS: SeedMenuDef[] = [
  // ── Roots ──
  {
    slug: 'dashboard',
    title: 'Dashboard',
    path: '/admin',
    icon: 'LayoutDashboard',
    sortOrder: 1,
    actionsConfig: { canView: true, canCreate: false, canEdit: false, canDelete: false, custom: [] },
  },
  { slug: 'accounting', title: 'Accounting', path: '/admin/accounting', icon: 'Banknote', sortOrder: 2 },
  {
    slug: 'reports',
    title: 'Financial & Audit Reports',
    path: '/admin/accounting/reports',
    icon: 'PieChart',
    sortOrder: 3,
    actionsConfig: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      custom: [
        { action: 'excel', label: 'Excel Export' },
        { action: 'pdf', label: 'PDF Export' },
        { action: 'print', label: 'Print' },
      ],
    },
  },
  { slug: 'exams', title: 'Exam & Result Engine', path: '/admin/academic-results', icon: 'Award', sortOrder: 4 },
  { slug: 'academics', title: 'Academics', path: '/admin/academic', icon: 'GraduationCap', sortOrder: 5 },
  { slug: 'students', title: 'Students', path: '/admin/students', icon: 'Users', sortOrder: 6 },
  { slug: 'teachers', title: 'Teachers', path: '/admin/teachers', icon: 'User', sortOrder: 7 },
  { slug: 'admission', title: 'Admission & Enrollment', path: '/admin/admissions', icon: 'UserPlus', sortOrder: 8 },
  { slug: 'website', title: 'Website Management', path: '/admin/website-management', icon: 'Globe', sortOrder: 9 },
  { slug: 'facilities', title: 'Facilities', path: '/admin/facilities', icon: 'Sparkles', sortOrder: 10 },
  { slug: 'others', title: 'Others', path: '/admin/others', icon: 'Bell', sortOrder: 11 },
  { slug: 'users', title: 'Users', path: '/admin/users', icon: 'UserCog', sortOrder: 12 },
  { slug: 'permission_management', title: 'Permission Management', path: '/admin/permission-management', icon: 'ShieldCheck', sortOrder: 13 },
  { slug: 'settings', title: 'Settings', path: '/admin/settings', icon: 'Settings', sortOrder: 14 },

  // ── Children under 'accounting' ──
  {
    slug: 'fees',
    title: 'Fee Management',
    path: '/admin/accounting/collection',
    icon: 'Zap',
    sortOrder: 20,
    parentSlug: 'accounting',
    actionsConfig: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      custom: [
        { action: 'excel', label: 'Excel Export' },
        { action: 'receipt', label: 'Print Receipt' },
      ],
    },
  },
  { slug: 'bank_reconciliation', title: 'MFS & Bank Reconciliation', path: '/admin/accounting/reconciliation', icon: 'Landmark', sortOrder: 21, parentSlug: 'accounting' },
  { slug: 'payroll', title: 'Payroll & MPO', path: '/admin/accounting/payroll', icon: 'FileText', sortOrder: 22, parentSlug: 'accounting' },

  // ── Children under 'exams' ──
  { slug: 'exam_setup', title: 'Exam Setup & Rules', path: '/admin/academic-results/settings', icon: 'SlidersHorizontal', sortOrder: 30, parentSlug: 'exams' },
  { slug: 'marks_entry', title: 'Marks Entry Desk', path: '/admin/academic-results/marks-entry', icon: 'ClipboardList', sortOrder: 31, parentSlug: 'exams' },
  { slug: 'results', title: 'Generate & Publish Result', path: '/admin/academic-results/process', icon: 'Zap', sortOrder: 32, parentSlug: 'exams' },
  { slug: 'marksheets', title: 'Marksheets & Reports', path: '/admin/academic-results/outputs', icon: 'Award', sortOrder: 33, parentSlug: 'exams' },

  // ── Children under 'admission' ──
  {
    slug: 'student_registry',
    title: 'Student Registry',
    path: '/admin/admissions/students',
    icon: 'FolderKanban',
    sortOrder: 40,
    parentSlug: 'admission',
    actionsConfig: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      custom: [
        { action: 'excel', label: 'Excel Export' },
        { action: 'pdf', label: 'ID Card PDF' },
      ],
    },
  },
  { slug: 'enrollment', title: 'Enrollment Lifecycle', path: '/admin/admissions/enrollments', icon: 'ClipboardList', sortOrder: 41, parentSlug: 'admission' },
  { slug: 'admission_settings', title: 'Admission Settings', path: '/admin/admissions/settings', icon: 'Settings', sortOrder: 42, parentSlug: 'admission' },
];

export type ActionName = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';

/** Role default templates: role → list of {menuSlug, actions}. */
export const ROLE_DEFAULTS: Record<string, { menuSlug: string; actions: ActionName[] }[]> = {
  superadmin: MENUS.map((m) => ({
    menuSlug: m.slug,
    actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] as ActionName[],
  })),
  admin: MENUS.map((m) => ({
    menuSlug: m.slug,
    actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] as ActionName[],
  })),
  management: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'accounting', actions: ['canView'] },
    { menuSlug: 'fees', actions: ['canView', 'canEdit'] },
    { menuSlug: 'bank_reconciliation', actions: ['canView'] },
    { menuSlug: 'payroll', actions: ['canView'] },
    { menuSlug: 'reports', actions: ['canView'] },
    { menuSlug: 'exams', actions: ['canView'] },
    { menuSlug: 'exam_setup', actions: ['canView'] },
    { menuSlug: 'marks_entry', actions: ['canView'] },
    { menuSlug: 'results', actions: ['canView'] },
    { menuSlug: 'marksheets', actions: ['canView'] },
    { menuSlug: 'academics', actions: ['canView'] },
    { menuSlug: 'students', actions: ['canView'] },
    { menuSlug: 'teachers', actions: ['canView'] },
    { menuSlug: 'admission', actions: ['canView'] },
    { menuSlug: 'student_registry', actions: ['canView'] },
    { menuSlug: 'enrollment', actions: ['canView'] },
    { menuSlug: 'admission_settings', actions: ['canView'] },
    { menuSlug: 'website', actions: ['canView'] },
    { menuSlug: 'facilities', actions: ['canView'] },
    { menuSlug: 'others', actions: ['canView'] },
    { menuSlug: 'settings', actions: ['canView'] },
  ],
  accountant: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'accounting', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'fees', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'bank_reconciliation', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'payroll', actions: ['canView', 'canEdit'] },
    { menuSlug: 'reports', actions: ['canView'] },
    { menuSlug: 'admission', actions: ['canView'] },
    { menuSlug: 'student_registry', actions: ['canView'] },
    { menuSlug: 'enrollment', actions: ['canView'] },
  ],
  teacher: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'academics', actions: ['canView'] },
    { menuSlug: 'students', actions: ['canView'] },
    { menuSlug: 'marks_entry', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'results', actions: ['canView'] },
    { menuSlug: 'marksheets', actions: ['canView'] },
    { menuSlug: 'website', actions: ['canView'] },
    { menuSlug: 'facilities', actions: ['canView'] },
    { menuSlug: 'others', actions: ['canView'] },
  ],
  exam_controller: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'exams', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'exam_setup', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'marks_entry', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'results', actions: ['canView', 'canCreate', 'canEdit'] },
    { menuSlug: 'marksheets', actions: ['canView'] },
    { menuSlug: 'reports', actions: ['canView'] },
    { menuSlug: 'academics', actions: ['canView'] },
    { menuSlug: 'students', actions: ['canView'] },
  ],
  student: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'academics', actions: ['canView'] },
    { menuSlug: 'students', actions: ['canView'] },
    { menuSlug: 'results', actions: ['canView'] },
    { menuSlug: 'website', actions: ['canView'] },
    { menuSlug: 'facilities', actions: ['canView'] },
    { menuSlug: 'others', actions: ['canView'] },
  ],
  guardian: [
    { menuSlug: 'dashboard', actions: ['canView'] },
    { menuSlug: 'results', actions: ['canView'] },
    { menuSlug: 'website', actions: ['canView'] },
    { menuSlug: 'facilities', actions: ['canView'] },
    { menuSlug: 'others', actions: ['canView'] },
  ],
};

async function seedMenus(prisma: PrismaService): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // Insert roots first (no parent), then children.
  for (const m of MENUS.filter((x) => !x.parentSlug)) {
    const existing = await prisma.menu.findUnique({ where: { slug: m.slug } });
    if (existing) {
      if (m.actionsConfig) {
        await prisma.menu.update({
          where: { id: existing.id },
          data: { actionsConfig: m.actionsConfig as any },
        });
      }
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
        actionsConfig: (m.actionsConfig as any) ?? null,
      },
    });
    map.set(m.slug, row.id);
    console.log(`[seed-authorization] created menu: ${m.slug}`);
  }
  for (const m of MENUS.filter((x) => x.parentSlug)) {
    const parentId = map.get(m.parentSlug!);
    if (!parentId) throw new Error(`Parent menu ${m.parentSlug} not found for ${m.slug}`);
    const existing = await prisma.menu.findUnique({ where: { slug: m.slug } });
    if (existing) {
      if (m.actionsConfig) {
        await prisma.menu.update({
          where: { id: existing.id },
          data: { actionsConfig: m.actionsConfig as any },
        });
      }
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
        actionsConfig: (m.actionsConfig as any) ?? null,
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
      const menuDef = MENUS.find((m) => m.slug === e.menuSlug);
      const customActions =
        role === 'superadmin' || role === 'admin'
          ? (menuDef?.actionsConfig?.custom?.map((c) => c.action) ?? [])
          : [];

      const existing = await prisma.roleDefaultPermission.findFirst({
        where: { role: role as any, menuId },
      });
      if (existing) {
        await prisma.roleDefaultPermission.update({
          where: { id: existing.id },
          data: {
            canView: e.actions.includes('canView'),
            canCreate: e.actions.includes('canCreate'),
            canEdit: e.actions.includes('canEdit'),
            canDelete: e.actions.includes('canDelete'),
            customActions: customActions.length > 0 ? (customActions as any) : null,
          },
        });
        continue;
      }
      await prisma.roleDefaultPermission.create({
        data: {
          role: role as any,
          menuId,
          canView: e.actions.includes('canView'),
          canCreate: e.actions.includes('canCreate'),
          canEdit: e.actions.includes('canEdit'),
          canDelete: e.actions.includes('canDelete'),
          customActions: customActions.length > 0 ? (customActions as any) : null,
        },
      });
    }
    console.log(`[seed-authorization] role defaults seeded: ${role}`);
  }
}

/** Seeds the one first-login default user for each core role (env-overridable). */
async function seedDefaultUsers(prisma: PrismaService) {
  for (const u of DEFAULT_USERS) {
    const email = process.env[u.emailEnvVar] || u.defaultEmail;
    const password = process.env[u.passwordEnvVar] || u.defaultPassword;

    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
      console.log(`[seed-authorization] ${u.role} exists: ${email}`);
      continue;
    }
    await prisma.users.create({
      data: {
        name: u.name,
        email,
        password, // hashed centrally by the Prisma extension
        role: u.role,
        isSuperAdmin: u.isSuperAdmin ?? false,
        isActive: true,
        isVerified: true,
      },
    });
    console.log(`[seed-authorization] created ${u.role}: ${email} (password: ${password})`);
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    const menuBySlug = await seedMenus(prisma);
    await seedRoleDefaults(prisma, menuBySlug);
    await seedDefaultUsers(prisma);
    console.log('[seed-authorization] done');
  } finally {
    await prisma.$disconnect();
  }
}

export { main };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
