import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { authSessions } from './db';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  hashSessionToken,
  resolvePasswordHash,
  verifyPassword,
} from './authUtils';

async function clearExpiredSessions(now = new Date().toISOString()) {
  await authSessions.clearExpired(now);
}

function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function authenticatePassword(password: string): boolean {
  return verifyPassword(password, resolvePasswordHash());
}

export async function createAuthSession(): Promise<string> {
  await clearExpiredSessions();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await authSessions.create(hashSessionToken(token), expiresAt);
  return token;
}

export async function revokeAuthSession(token: string | undefined): Promise<void> {
  if (!token) {
    return;
  }

  await authSessions.deleteByTokenHash(hashSessionToken(token));
}

export async function isAuthenticatedToken(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  await clearExpiredSessions();

  const session = await authSessions.getByTokenHash(hashSessionToken(token));
  if (!session) {
    return false;
  }

  if (Date.parse(session.expires_at) <= Date.now()) {
    await authSessions.deleteByTokenHash(session.token_hash);
    return false;
  }

  return true;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return await isAuthenticatedToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, buildCookieOptions());
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...buildCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export async function requireApiAuth(request: NextRequest): Promise<NextResponse | null> {
  if (await isAuthenticatedToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return null;
  }

  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
