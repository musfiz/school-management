import * as bcrypt from 'bcryptjs';

/**
 * Password helpers that replace the `User` TypeORM entity's
 * `@BeforeInsert`/`@BeforeUpdate` hash hook and `comparePassword()` method
 * (docs/PRISMA_MIGRATION_PLAN.md AD-P8 / Q4).
 *
 * Hashing itself is applied centrally through the Prisma Client extension
 * (`src/prisma/password-hashing.extension.ts`); these helpers hold the actual
 * bcrypt logic so it is unit-testable and shared by the extension and the auth
 * service.
 */

/** bcrypt hashes start with `$2` (`$2a$` / `$2b$`); the old hook used this as
 *  its "already hashed, leave it alone" guard, preserved verbatim. */
export function isPasswordHash(value: string): boolean {
  return value.startsWith('$2');
}

/** Hash a plaintext password exactly like the old `User.hashPassword` hook:
 *  `genSalt(10)` then `hash`. Values that already look like a bcrypt hash pass
 *  through unchanged, matching the hook's guard. */
export async function hashPassword(plain: string): Promise<string> {
  if (isPasswordHash(plain)) return plain;
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

/** Compare a plaintext candidate against a stored bcrypt hash — the drop-in
 *  replacement for `user.comparePassword(plain)`. */
export async function comparePassword(
  user: { password: string },
  plainPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, user.password);
}
