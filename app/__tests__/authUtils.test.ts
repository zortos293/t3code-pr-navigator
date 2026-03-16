import { createPasswordHash, createSessionToken, hashSessionToken, verifyPassword } from '@/app/lib/authUtils';

describe('authUtils', () => {
  it('verifies a scrypt password hash', () => {
    const hash = createPasswordHash('T3coder!!', 'unit-test-salt');

    expect(verifyPassword('T3coder!!', hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('creates stable token hashes and random session tokens', () => {
    const token = createSessionToken();

    expect(token).not.toHaveLength(0);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });
});
