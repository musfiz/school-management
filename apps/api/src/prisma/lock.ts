import { Prisma } from '../generated/prisma/client';

/**
 * AD-P7 — pessimistic row locks (docs/PRISMA_MIGRATION_PLAN.md).
 *
 * Prisma has no `setLock('pessimistic_write')`; this helper reproduces the
 * TypeORM semantics inside the caller's transaction:
 *
 *   SELECT 1 FROM <table> WHERE <where> FOR UPDATE
 *
 * It must be called with a `Prisma.TransactionClient` (a `$transaction`
 * callback argument) so the row lock is held for the rest of the unit of work
 * and concurrent writers serialise on the matched row. On a missing row InnoDB
 * takes the equivalent gap lock, so the "two creators race to insert a new
 * sequence scope" pattern still behaves as it did under TypeORM.
 *
 * `table` is a raw identifier (never user input) and `where` a parameterised
 * `Prisma.sql` fragment.
 */
export async function lockRow(
  tx: Prisma.TransactionClient,
  table: string,
  where: Prisma.Sql,
): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM ${Prisma.raw(table)} WHERE ${where} FOR UPDATE`;
}
