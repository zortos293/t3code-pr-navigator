import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, revokeAuthSession } from '@/app/lib/auth';
import { SESSION_COOKIE_NAME } from '@/app/lib/authUtils';

export async function POST(request: NextRequest) {
  try {
    revokeAuthSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    const response = NextResponse.json({ success: true });
    return clearSessionCookie(response);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
