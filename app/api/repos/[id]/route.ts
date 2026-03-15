import { NextRequest, NextResponse } from 'next/server';
import { repos, issues, pullRequests, relationships, duplicates } from '@/app/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repoId = parseInt(id, 10);
    const repo = repos.getById(repoId);
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const repoIssues = issues.getByRepoId(repoId);
    const repoPRs = pullRequests.getByRepoId(repoId);
    const repoRelationships = relationships.getByRepoId(repoId);
    const repoDuplicates = duplicates.getByRepoId(repoId);

    return NextResponse.json({
      ...repo,
      issues: repoIssues,
      pull_requests: repoPRs,
      relationships: repoRelationships,
      duplicates: repoDuplicates,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repoId = parseInt(id, 10);
    const repo = repos.getById(repoId);
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    repos.delete(repoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
