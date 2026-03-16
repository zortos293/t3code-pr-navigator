import { NextRequest, NextResponse } from 'next/server';
import { commentCaches } from '@/app/lib/db';
import { fetchComments } from '@/app/lib/github';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const owner = searchParams.get('owner');
    const name = searchParams.get('name');
    const number = searchParams.get('number');
    const repoId = searchParams.get('repoId');

    if (!owner || !name || !number || !repoId) {
      return NextResponse.json(
        { error: 'owner, name, number, and repoId are required' },
        { status: 400 }
      );
    }

    const parsedNumber = Number.parseInt(number, 10);
    const parsedRepoId = Number.parseInt(repoId, 10);

    if (Number.isNaN(parsedNumber) || Number.isNaN(parsedRepoId)) {
      return NextResponse.json({ error: 'number and repoId must be valid integers' }, { status: 400 });
    }

    const cachedComments = await commentCaches.getByRepoAndGitHubNumber(parsedRepoId, parsedNumber);
    if (cachedComments) {
      return NextResponse.json(cachedComments.comments);
    }

    const comments = await fetchComments(owner, name, parsedNumber);
    await commentCaches.upsert({
      repo_id: parsedRepoId,
      github_number: parsedNumber,
      comments,
      fetched_at: new Date().toISOString(),
    });

    return NextResponse.json(comments);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
