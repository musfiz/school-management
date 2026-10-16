import type { PrismaService } from '../../src/prisma/prisma.service';

export type PrismaModelMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
};

export type PrismaMock = {
  siteSettings: PrismaModelMock;
  pages: PrismaModelMock;
  sliders: PrismaModelMock;
  heroSections: PrismaModelMock;
  governingBodyMembers: PrismaModelMock;
  exPrincipals: PrismaModelMock;
  staffMembers: PrismaModelMock;
  teachers: PrismaModelMock;
  notices: PrismaModelMock;
  modules: PrismaModelMock;
  // Wave 2 — identity & access
  users: PrismaModelMock;
  permissions: PrismaModelMock;
  userPermissions: PrismaModelMock;
  menuItems: PrismaModelMock;
  // Wave 3 — documents & uploads
  paymentCollections: PrismaModelMock;
  studentInvoices: PrismaModelMock;
  studentInvoiceLines: PrismaModelMock;
  /** Runs the callback with this same mock standing in for the tx client. */
  $transaction: jest.Mock;
};

/**
 * A `jest.fn()`-backed stand-in for `PrismaService`, exposing exactly the model
 * delegates the migrated services call. Cast it with `asPrisma()` when
 * constructing a service so the service's `PrismaService` parameter type is
 * satisfied.
 */
export function createPrismaMock(): PrismaMock {
  const model = (): PrismaModelMock => ({
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  });

  const mock: PrismaMock = {
    siteSettings: model(),
    pages: model(),
    sliders: model(),
    heroSections: model(),
    governingBodyMembers: model(),
    exPrincipals: model(),
    staffMembers: model(),
    teachers: model(),
    notices: model(),
    modules: model(),
    users: model(),
    permissions: model(),
    userPermissions: model(),
    menuItems: model(),
    paymentCollections: model(),
    studentInvoices: model(),
    studentInvoiceLines: model(),
    $transaction: jest.fn(),
  };

  // Interactive transactions hand the callback a client exposing the same
  // delegates, so `prisma.$transaction(async (tx) => …)` works under test.
  mock.$transaction.mockImplementation(
    (fn: (tx: PrismaMock) => Promise<unknown>) => fn(mock),
  );

  return mock;
}

export function asPrisma(mock: PrismaMock): PrismaService {
  return mock as unknown as PrismaService;
}
