import { NextRequest, NextResponse } from 'next/server';
import { repos } from '@/app/lib/db';
import { syncRepository } from '@/app/lib/github';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repoId = parseInt(id, 10);
    const repo = repos.getById(repoId);
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const counts = await syncRepository(repoId, repo.owner, repo.name);
    repos.update(repoId, {
      open_issues_count: counts.issues,
      open_prs_count: counts.pullRequests,
    });

    return NextResponse.json({
      success: true,
      issues: counts.issues,
      pullRequests: counts.pullRequests,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
