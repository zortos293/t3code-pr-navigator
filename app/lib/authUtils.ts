import crypto from 'node:crypto';

export const APP_PASSWORD_HASH_ENV_KEY = 'APP_PASSWORD_HASH';
export const DEFAULT_PASSWORD_HASH = 'scrypt:pr-navigator-auth-v1:931b3b0757c3c0ba147eecfad7272b139895f229d16e0254fb1b59ec0e63fd45f895f77a7e9c781ee76d87f928e984bacb3d165d521650de50bf971a9260a373';
export const SESSION_COOKIE_NAME = 'pr_navigator_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

type ParsedHash = {
  algorithm: 'scrypt';
  salt: string;
  digest: string;
};

function parsePasswordHash(value: string): ParsedHash | null {
  const [algorithm, salt, digest] = value.split(':');
  if (algorithm !== 'scrypt' || !salt || !digest) {
    return null;
  }

  return {
    algorithm,
    salt,
    digest,
  };
}

export function createPasswordHash(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${digest}`;
}

export function resolvePasswordHash(): string {
  return process.env[APP_PASSWORD_HASH_ENV_KEY] || DEFAULT_PASSWORD_HASH;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parsed = parsePasswordHash(storedHash);
  if (!parsed) {
    return false;
  }

  const expected = Buffer.from(parsed.digest, 'hex');
  const actual = crypto.scryptSync(password, parsed.salt, expected.length);

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
