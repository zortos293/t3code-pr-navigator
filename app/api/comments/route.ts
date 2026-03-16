import { NextRequest, NextResponse } from 'next/server';
import { fetchComments } from '@/app/lib/github';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const owner = searchParams.get('owner');
    const name = searchParams.get('name');
    const number = searchParams.get('number');

    if (!owner || !name || !number) {
      return NextResponse.json(
        { error: 'owner, name, and number are required' },
        { status: 400 }
      );
    }

    const comments = await fetchComments(owner, name, parseInt(number, 10));
    return NextResponse.json(comments);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
