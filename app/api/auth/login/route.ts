import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Authentication is disabled' }, { status: 404 });
}
