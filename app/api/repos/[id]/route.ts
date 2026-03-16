import { NextRequest, NextResponse } from 'next/server';
import { repos, issues, pullRequests, relationships, duplicates, activityEvents } from '@/app/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repoId = parseInt(id, 10);
    const repo = await repos.getById(repoId);
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const [repoIssues, repoPRs, repoRelationships, repoDuplicates, repoActivity] = await Promise.all([
      issues.getByRepoId(repoId),
      pullRequests.getByRepoId(repoId),
      relationships.getByRepoId(repoId),
      duplicates.getByRepoId(repoId),
      activityEvents.getByRepoId(repoId),
    ]);

    const openIssues = repoIssues.filter((issue) => issue.state === 'open');
    const openPullRequests = repoPRs.filter((pullRequest) => pullRequest.state === 'open');
    const openIssueIds = new Set(openIssues.map((issue) => issue.id));
    const openPullRequestIds = new Set(openPullRequests.map((pullRequest) => pullRequest.id));
    const visibleRelationships = repoRelationships.filter(
      (relationship) =>
        openIssueIds.has(relationship.issue_id) &&
        openPullRequestIds.has(relationship.pr_id),
    );
    const visibleDuplicates = repoDuplicates.filter(
      (duplicate) =>
        openIssueIds.has(duplicate.original_issue_id) &&
        openIssueIds.has(duplicate.duplicate_issue_id),
    );

    return NextResponse.json({
      ...repo,
      issues: openIssues,
      pull_requests: openPullRequests,
      relationships: visibleRelationships,
      duplicates: visibleDuplicates,
      tracked_pull_requests: repoPRs,
      tracked_relationships: repoRelationships,
      activity: repoActivity,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repoId = parseInt(id, 10);
    const repo = await repos.getById(repoId);
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    await repos.delete(repoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
