import { NextRequest, NextResponse } from 'next/server';
import { pullRequests } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const repoId = request.nextUrl.searchParams.get('repo_id');
    if (!repoId) {
      return NextResponse.json({ error: 'repo_id is required' }, { status: 400 });
    }
    const result = pullRequests.getByRepoId(parseInt(repoId, 10));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
