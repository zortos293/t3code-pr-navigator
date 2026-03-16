import { NextRequest, NextResponse } from 'next/server';
import { attachSessionCookie, authenticatePassword, createAuthSession } from '@/app/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { password?: string };
    const password = body.password?.trim();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (!authenticatePassword(password)) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    return attachSessionCookie(response, createAuthSession());
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
