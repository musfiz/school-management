import { comparePassword, hashPassword, isPasswordHash } from './user.util';

describe('user.util (AD-P8)', () => {
  it('isPasswordHash recognises bcrypt hashes only', () => {
    expect(isPasswordHash('$2a$10$abcdefghijklmnopqrstuv')).toBe(true);
    expect(isPasswordHash('$2b$10$abcdefghijklmnopqrstuv')).toBe(true);
    expect(isPasswordHash('plaintext')).toBe(false);
    expect(isPasswordHash('')).toBe(false);
  });

  it('hashPassword bcrypt-hashes plaintext and comparePassword verifies it', async () => {
    const hash = await hashPassword('secret123');
    expect(hash.startsWith('$2')).toBe(true);

    await expect(
      comparePassword({ password: hash }, 'secret123'),
    ).resolves.toBe(true);
    await expect(
      comparePassword({ password: hash }, 'wrong-password'),
    ).resolves.toBe(false);
  });

  it('hashPassword leaves an existing hash untouched (the old $2 guard)', async () => {
    const first = await hashPassword('secret123');
    const second = await hashPassword(first);
    expect(second).toBe(first);
  });
});
