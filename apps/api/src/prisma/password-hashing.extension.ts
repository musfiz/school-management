import { Prisma } from '../generated/prisma/client';
import { hashPassword } from '../users/user.util';

/**
 * Central Prisma Client extension that hashes `users.password` on every write
 * through Prisma (docs/PRISMA_MIGRATION_PLAN.md AD-P8 / Q4 — decision: "central
 * `$extends`", so the invariant survives every call site: services, seeders and
 * any future module).
 *
 * It replaces the `User` TypeORM entity's `@BeforeInsert` / `@BeforeUpdate`
 * `hashPassword()` hook. The hook only hashed values that did not already look
 * like a bcrypt hash (`!password.startsWith('$2')`); `hashPassword()` keeps that
 * guard.
 *
 * `updateLastLogin` writes `lastLoginAt` (no `password`), so it is untouched.
 */
export const passwordHashingExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'password-hashing',
    query: {
      users: {
        async create({ args, query }) {
          if (typeof args.data?.password === 'string') {
            args.data.password = await hashPassword(args.data.password);
          }
          return query(args);
        },
        async createMany({ args, query }) {
          const data = args.data;
          if (Array.isArray(data)) {
            await Promise.all(
              data.map(async (row) => {
                if (typeof row.password === 'string') {
                  row.password = await hashPassword(row.password);
                }
              }),
            );
          } else if (typeof data?.password === 'string') {
            data.password = await hashPassword(data.password);
          }
          return query(args);
        },
        async update({ args, query }) {
          if (typeof args.data?.password === 'string') {
            args.data.password = await hashPassword(args.data.password);
          }
          return query(args);
        },
        async upsert({ args, query }) {
          if (typeof args.create?.password === 'string') {
            args.create.password = await hashPassword(args.create.password);
          }
          if (typeof args.update?.password === 'string') {
            args.update.password = await hashPassword(args.update.password);
          }
          return query(args);
        },
      },
    },
  }),
);
