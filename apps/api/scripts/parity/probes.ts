/**
 * Parity probes (docs/PRISMA_MIGRATION_PLAN.md §9).
 *
 * Each probe returns a deterministic, serialisable snapshot of behaviour.
 * Before a module wave is migrated, run `parity --record` to capture the
 * TypeORM-produced golden; after the wave, run `parity` to prove the
 * Prisma-produced output is identical.
 *
 * Wave 0 probes snapshot representative DB state through Prisma so the harness
 * is proven end-to-end from the start. Wave 1+ probes resolve the module's
 * service from the Nest container (see run.ts) and call its public read methods,
 * so they exercise the exact code path being rewritten.
 */
import type { INestApplicationContext } from '@nestjs/common';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { SiteSettingsService } from '../../src/site-settings/site-settings.service';
import { PagesService } from '../../src/pages/pages.service';
import { SlidersService } from '../../src/sliders/sliders.service';
import { HeroSectionService } from '../../src/hero-section/hero-section.service';
import { GoverningBodyService } from '../../src/governing-body/governing-body.service';
import { ExPrincipalsService } from '../../src/ex-principals/ex-principals.service';
import { StaffService } from '../../src/staff/staff.service';
import { TeacherService } from '../../src/teachers/teacher.service';
import { NoticesService } from '../../src/notices/notices.service';
import { ModulesService } from '../../src/modules/modules.service';
import { UsersService } from '../../src/users/users.service';
import { AuthService } from '../../src/auth/auth.service';
import { PermissionsService } from '../../src/permissions/permissions.service';
import { MenusService } from '../../src/menus/menus.service';
import { DocumentsService } from '../../src/documents/documents.service';
import type { MenuLocation } from '../../src/database/entities/menu-item.entity';
import { inflateSync } from 'node:zlib';

export interface ProbeContext {
  app: INestApplicationContext;
  prisma: PrismaClient;
}

export interface Probe {
  name: string;
  run: (ctx: ProbeContext) => Promise<unknown>;
}

/** Drop menu ids so a round-tripped tree compares structurally, not by UUID. */
function stripMenuIds(nodes: Array<Record<string, unknown>>): unknown[] {
  return nodes.map((node) => {
    const { id, children, ...rest } = node;
    void id;
    return {
      ...rest,
      children: stripMenuIds((children ?? []) as Array<Record<string, unknown>>),
    };
  });
}

/** HTTP status of a thrown Nest exception, or its name for non-HTTP errors. */
function statusOf(err: unknown): number | string {
  const status = (err as { getStatus?: () => number })?.getStatus?.();
  return typeof status === 'number' ? status : String((err as Error)?.name ?? 'error');
}

/** Today's local-ISO date, rendered as-is by the PDF footer / receipt meta. */
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const hideToday = (s: string): string => s.split(TODAY_ISO).join('<TODAY>');

function decodePdfLiteral(o: string): string {
  return o
    .slice(1, -1)
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\(\d{1,3})/g, (_m, oct: string) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Extract a pdf-lib document's visible text, in draw order.
 *
 * A byte-level sha256 is NOT a valid parity signal: pdf-lib stamps `/ModDate`
 * (second granularity) and renames embedded fonts with a random suffix on every
 * `save()`, so identical input yields different bytes on every run. The drawn
 * text is stable, so probes compare that instead.
 */
export function pdfTextLines(buffer: Buffer): string[] {
  const raw = buffer.toString('latin1');
  const out: string[] = [];
  const re = /(?<![a-zA-Z])stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    let chunk = Buffer.from(raw.slice(start, end), 'latin1');
    try {
      chunk = inflateSync(chunk);
    } catch {
      /* not deflated */
    }
    const s = chunk.toString('latin1');
    const ops = s.match(/(?:<[0-9A-Fa-f\s]+>|\((?:\\.|[^\\()])*\))\s*Tj/g) ?? [];
    for (const op of ops) {
      const token = op.replace(/\s*Tj$/, '').trim();
      if (token.startsWith('<')) {
        out.push(Buffer.from(token.slice(1, -1).replace(/\s+/g, ''), 'hex').toString('latin1'));
      } else {
        out.push(decodePdfLiteral(token));
      }
    }
  }
  return out;
}

/** Deterministic snapshot of a generated PDF (filename + visible text). */
function pdfSnapshot(filename: string, buffer: Buffer): {
  filename: string;
  text: string[];
} {
  return { filename: hideToday(filename), text: pdfTextLines(buffer).map(hideToday) };
}

const WAVE3_FIXTURE = {
  invoiceNo: 'PARITY-W3-INV-1',
  billingPeriod: 'PARITY-W3-BP',
  receiptNo: 'PARITY-W3-MR-1',
  // Fixed ids keep the invoice line rows in a stable (PK) order across runs.
  invoiceId: 'aaaaaaa1-0000-4000-8000-000000000001',
  lineIds: [
    'aaaaaaa1-0000-4000-8000-000000000101',
    'aaaaaaa1-0000-4000-8000-000000000102',
  ],
  collectionId: 'aaaaaaa1-0000-4000-8000-000000000201',
};

/** Remove any Wave 3 fixture rows (idempotent, FK-safe order). */
async function wave3Cleanup(prisma: PrismaClient): Promise<void> {
  await prisma.paymentCollections.deleteMany({
    where: {
      OR: [
        { moneyReceiptNo: WAVE3_FIXTURE.receiptNo },
        { id: WAVE3_FIXTURE.collectionId },
      ],
    },
  });
  const stale = await prisma.studentInvoices.findMany({
    where: { invoiceNo: WAVE3_FIXTURE.invoiceNo },
  });
  for (const s of stale) {
    await prisma.paymentCollections.deleteMany({ where: { invoiceId: s.id } });
    await prisma.studentInvoiceLines.deleteMany({ where: { invoiceId: s.id } });
    await prisma.studentInvoices.deleteMany({ where: { id: s.id } });
  }
}

/**
 * Create a self-contained invoice + line + collection fixture (using seeded
 * accounting parents), run `fn` with their ids, then clean up. The fixture is
 * built through Prisma in both the record and compare runs, so the only thing
 * under test is the service reading it back.
 */
async function withWave3Fixture<T>(
  prisma: PrismaClient,
  fn: (ids: { invoiceId: string; collectionId: string }) => Promise<T>,
): Promise<T> {
  await wave3Cleanup(prisma);

  const [fiscal, gl, feeHead, fund, admin] = await Promise.all([
    prisma.fiscalPeriods.findFirst(),
    prisma.chartOfAccounts.findFirst(),
    prisma.feeHeads.findFirst(),
    prisma.funds.findFirst(),
    prisma.users.findFirst({ where: { role: 'admin' } }),
  ]);
  if (!fiscal || !gl || !feeHead || !fund || !admin) {
    throw new Error('Wave 3 probe: missing seeded FK rows (fiscal/GL/fee head/fund/admin)');
  }

  const invoice = await prisma.studentInvoices.create({
    data: {
      id: WAVE3_FIXTURE.invoiceId,
      invoiceNo: WAVE3_FIXTURE.invoiceNo,
      studentId: admin.id,
      billingPeriod: WAVE3_FIXTURE.billingPeriod,
      issueDate: new Date('2026-04-01T00:00:00.000Z'),
      dueDate: new Date('2026-05-01T00:00:00.000Z'),
      status: 'UNPAID',
      grossAmount: '6000.00',
      waiverAmount: '1000.00',
      netAmount: '5000.00',
      paidAmount: '2000.00',
      lateFineAmount: '100.00',
      fiscalPeriodId: fiscal.id,
      narration: 'Parity Wave 3 fixture invoice',
    },
  });
  await prisma.studentInvoiceLines.createMany({
    data: [
      {
        id: WAVE3_FIXTURE.lineIds[0],
        invoiceId: invoice.id,
        feeHeadId: feeHead.id,
        glAccountId: gl.id,
        fundId: fund.id,
        creditHours: '3.00',
        grossAmount: '4000.00',
        waiverAmount: '500.00',
        netAmount: '3500.00',
        lineMemo: 'Tuition',
      },
      {
        id: WAVE3_FIXTURE.lineIds[1],
        invoiceId: invoice.id,
        feeHeadId: feeHead.id,
        glAccountId: gl.id,
        fundId: fund.id,
        creditHours: '0.00',
        grossAmount: '2000.00',
        waiverAmount: '500.00',
        netAmount: '1500.00',
        lineMemo: 'Exam fee',
      },
    ],
  });
  const collection = await prisma.paymentCollections.create({
    data: {
      id: WAVE3_FIXTURE.collectionId,
      moneyReceiptNo: WAVE3_FIXTURE.receiptNo,
      studentId: admin.id,
      invoiceId: invoice.id,
      paymentChannel: 'CASH',
      collectedGrossAmount: '2000.00',
      gatewayTdrFee: '0.00',
      netBankAmount: '2000.00',
      cashGlId: gl.id,
      reconciliationStatus: 'COLLECTED',
      allocation: JSON.stringify([
        { label: 'Tuition', glCode: gl.glCode, amount: '2000.00' },
      ]),
      collectedByUserId: admin.id,
      remark: 'Parity Wave 3 fixture receipt',
    },
  });

  try {
    return await fn({ invoiceId: invoice.id, collectionId: collection.id });
  } finally {
    await wave3Cleanup(prisma);
  }
}

export const probes: Probe[] = [
  // ----- Wave 0: DB-snapshot probes (Prisma direct) -----
  {
    name: 'users.by_role',
    run: async ({ prisma }) => {
      const rows = await prisma.users.groupBy({
        by: ['role'],
        _count: { _all: true },
      });
      return rows
        .map((row) => ({ role: row.role, count: row._count._all }))
        .sort((a, b) => a.role.localeCompare(b.role));
    },
  },
  {
    name: 'academic-subjects.sample',
    run: ({ prisma }) =>
      prisma.academicSubjects.findMany({
        orderBy: { subjectCode: 'asc' },
        take: 10,
        select: { subjectCode: true, subjectName: true, boardStream: true },
      }),
  },
  {
    name: 'journal.totals',
    run: async ({ prisma }) => {
      const [count, agg] = await Promise.all([
        prisma.journalEntries.count(),
        prisma.journalLines.aggregate({
          _sum: { debitAmount: true, creditAmount: true },
        }),
      ]);
      return {
        count,
        debit: agg._sum.debitAmount,
        credit: agg._sum.creditAmount,
      };
    },
  },
  {
    name: 'chart-of-accounts.sample',
    run: ({ prisma }) =>
      prisma.chartOfAccounts.findMany({
        orderBy: { glCode: 'asc' },
        take: 10,
        select: { glCode: true, accountName: true, accountType: true },
      }),
  },

  // ----- Wave 1: CMS modules (service-level reads) -----
  {
    name: 'wave1.site-settings.find',
    run: ({ app }) => app.get(SiteSettingsService).find(),
  },
  {
    name: 'wave1.pages.by-slug',
    run: async ({ app }) => {
      const pages = app.get(PagesService);
      const slugs = ['about-us', 'chairman-speech', 'principal-speech', 'missing-page'];
      const out: Record<string, unknown> = {};
      for (const slug of slugs) {
        try {
          out[slug] = await pages.findBySlug(slug);
        } catch {
          out[slug] = null; // NotFoundException → stable sentinel
        }
      }
      return out;
    },
  },
  {
    name: 'wave1.sliders.lists',
    run: async ({ app }) => {
      const sliders = app.get(SlidersService);
      return { all: await sliders.findAll(), active: await sliders.findActive() };
    },
  },
  {
    name: 'wave1.hero-section.find',
    run: ({ app }) => app.get(HeroSectionService).find(),
  },
  {
    name: 'wave1.governing-body.findAll',
    run: ({ app }) => app.get(GoverningBodyService).findAll(),
  },
  {
    name: 'wave1.ex-principals.findAll',
    run: ({ app }) => app.get(ExPrincipalsService).findAll(),
  },
  {
    name: 'wave1.staff.findAll',
    run: ({ app }) => app.get(StaffService).findAll(),
  },
  {
    name: 'wave1.teachers.findAll',
    run: ({ app }) => app.get(TeacherService).findAll(),
  },
  {
    name: 'wave1.notices.lists',
    run: async ({ app }) => {
      const notices = app.get(NoticesService);
      return { active: await notices.findAll(true), all: await notices.findAll(false) };
    },
  },
  {
    name: 'wave1.modules.findAll',
    run: ({ app }) => app.get(ModulesService).findAll(),
  },

  // ----- Wave 2: identity & access -----
  // Reads (deterministic, straight off the migrated services).
  {
    name: 'wave2.users.findAll',
    run: ({ app }) => app.get(UsersService).findAll(),
  },
  {
    name: 'wave2.users.findByEmail',
    run: async ({ app }) => {
      const users = app.get(UsersService);
      const emails = ['admin@school.com', 'student@school.com', 'nobody@example.com'];
      const out: Record<string, unknown> = {};
      for (const email of emails) out[email] = await users.findByEmail(email);
      return out;
    },
  },
  {
    name: 'wave2.users.findOne',
    run: async ({ app }) => {
      const users = app.get(UsersService);
      const admin = await users.findByEmail('admin@school.com');
      if (!admin) return null;
      return users.findOne(admin.id);
    },
  },
  {
    name: 'wave2.permissions.findAll',
    run: ({ app }) => app.get(PermissionsService).findAllPermissions(),
  },
  {
    name: 'wave2.permissions.getUserPermissions',
    run: async ({ app }) => {
      const perms = app.get(PermissionsService);
      const users = app.get(UsersService);
      const admin = await users.findByEmail('admin@school.com');
      return {
        admin: admin ? await perms.getUserPermissions(admin.id) : null,
        unknown: await perms.getUserPermissions(
          '00000000-0000-0000-0000-0000000000ff',
        ),
      };
    },
  },
  {
    name: 'wave2.menus.publicTree',
    run: ({ app }) => app.get(MenusService).findPublicTree('header'),
  },
  {
    name: 'wave2.menus.fullTree',
    run: ({ app }) => app.get(MenusService).findFullTree('header'),
  },

  // Writes (self-cleaning, deterministic summary — proves the write paths).
  {
    name: 'wave2.auth.register-login',
    run: async ({ app }) => {
      const auth = app.get(AuthService);
      const users = app.get(UsersService);
      const email = 'parity-wave2-auth@example.com';
      const cleanup = async () => {
        const existing = await users.findByEmail(email);
        if (existing) await users.remove(existing.id);
      };

      await cleanup();
      try {
        const registered = await auth.register({
          name: 'Parity Wave2 Auth',
          email,
          password: 'parity-pass-123',
        });
        const login = await auth.login({ email, password: 'parity-pass-123' });
        let wrongRejected = false;
        try {
          await auth.login({ email, password: 'wrong-pass-999' });
        } catch {
          wrongRejected = true;
        }
        return {
          registeredRole: registered.user.role,
          tokenIsString:
            typeof registered.access_token === 'string' &&
            registered.access_token.length > 0,
          loginEmail: login.user.email,
          loginPermissions: login.user.permissions,
          wrongRejected,
        };
      } finally {
        await cleanup();
      }
    },
  },
  {
    name: 'wave2.permissions.assign-revoke',
    run: async ({ app }) => {
      const users = app.get(UsersService);
      const perms = app.get(PermissionsService);
      const email = 'parity-wave2-perm@example.com';
      const cleanup = async () => {
        const existing = await users.findByEmail(email);
        if (existing) await users.remove(existing.id);
      };

      await cleanup();
      try {
        const user = await users.create({
          name: 'Parity Wave2 Perm',
          email,
          password: 'parity-pass-123',
          role: 'student' as never,
        });
        const before = await perms.getUserPermissions(user.id);
        const assigned = await perms.assignPermission(
          user.id,
          'view-website-management',
        );
        const after = await perms.getUserPermissions(user.id);
        await perms.revokePermission(user.id, 'view-website-management');
        const revoked = await perms.getUserPermissions(user.id);
        return {
          before,
          after,
          revoked,
          assignedIsIdempotentRecord:
            typeof assigned.permission_id === 'string',
        };
      } finally {
        await cleanup();
      }
    },
  },
  {
    name: 'wave2.menus.replace-tree',
    run: async ({ app, prisma }) => {
      const menus = app.get(MenusService);
      const location = 'parity-w2' as MenuLocation;
      const cleanup = () =>
        prisma.menuItems.deleteMany({ where: { menuLocation: 'parity-w2' } });

      await cleanup();
      try {
        const tree = await menus.replaceTree(location, [
          {
            labelEn: 'Alpha',
            labelBn: null,
            href: '/alpha',
            isVisible: true,
            children: [
              { labelEn: 'Alpha One', href: '/alpha/one' },
              { labelEn: 'Alpha Two', href: '/alpha/two', isVisible: false },
            ],
          },
          { labelEn: 'Beta', href: '/beta', isVisible: false },
        ]);
        return stripMenuIds(tree as unknown as Array<Record<string, unknown>>);
      } finally {
        await cleanup();
      }
    },
  },

  /* ── Wave 3 — Documents & uploads ─────────────────────────── */
  {
    name: 'wave3.documents.money-receipt.not-found',
    run: async ({ app }) => {
      const documents = app.get(DocumentsService);
      try {
        await documents.moneyReceiptPdf('00000000-0000-0000-0000-00000000dead');
        return { status: 'no-throw' };
      } catch (err) {
        return { status: statusOf(err) };
      }
    },
  },
  {
    name: 'wave3.documents.student-invoice.not-found',
    run: async ({ app }) => {
      const documents = app.get(DocumentsService);
      try {
        await documents.studentInvoicePdf('00000000-0000-0000-0000-00000000dead');
        return { status: 'no-throw' };
      } catch (err) {
        return { status: statusOf(err) };
      }
    },
  },
  {
    name: 'wave3.documents.generic-report-pdf',
    run: async ({ app }) => {
      const documents = app.get(DocumentsService);
      const { filename, buffer } = await documents.genericReportPdf({
        title: 'Parity Wave 3 Report',
        subtitle: 'Documents migration',
        meta: [{ label: 'Prepared', value: 'Parity harness' }],
        columns: [
          { header: '#', width: 1, align: 'center' },
          { header: 'Particulars', width: 5 },
          { header: 'Amount (BDT)', width: 3, align: 'right' },
        ],
        rows: [
          ['1', 'Tuition', '1000.00'],
          ['2', 'Exam fee', '250.50'],
        ],
        totals: [{ label: 'Total', value: '1250.50 BDT' }],
        notes: ['Parity fixture note'],
        signatures: ['Prepared By', 'Principal'],
        copiesLine: 'Office copy | Student copy',
      });
      return pdfSnapshot(filename, buffer);
    },
  },
  {
    name: 'wave3.documents.fixture-pdfs',
    run: async ({ app, prisma }) => {
      const documents = app.get(DocumentsService);
      return withWave3Fixture(prisma, async ({ invoiceId, collectionId }) => {
        const receipt = await documents.moneyReceiptPdf(collectionId);
        const invoice = await documents.studentInvoicePdf(invoiceId);
        return {
          receipt: pdfSnapshot(receipt.filename, receipt.buffer),
          invoice: pdfSnapshot(invoice.filename, invoice.buffer),
        };
      });
    },
  },
];
