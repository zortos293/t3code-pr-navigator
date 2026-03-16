import { describe, expect, it } from 'vitest';
import { projectRepoBoardData } from '../lib/repoView';
import type { Issue, PullRequest } from '../lib/db';
import type { Relationship } from '../lib/types';

function makeIssue(id: number, githubNumber: number, overrides: Partial<Issue> = {}): Issue {
  return {
    id,
    repo_id: 1,
    github_number: githubNumber,
    title: `Issue #${githubNumber}`,
    body: null,
    state: 'open',
    author: 'octocat',
    author_avatar: null,
    labels: null,
    created_at: null,
    updated_at: null,
    closed_at: null,
    ...overrides,
  };
}

function makePullRequest(id: number, githubNumber: number, overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id,
    repo_id: 1,
    github_number: githubNumber,
    title: `PR #${githubNumber}`,
    body: null,
    state: 'open',
    author: 'octocat',
    author_avatar: null,
    labels: null,
    additions: 10,
    deletions: 2,
    changed_files: 1,
    draft: 0,
    created_at: null,
    updated_at: null,
    merged_at: null,
    closed_at: null,
    ...overrides,
  };
}

describe('projectRepoBoardData', () => {
  it('keeps linked merged pull requests visible on the board', () => {
    const issues = [makeIssue(1, 101)];
    const pullRequests = [
      makePullRequest(11, 201, { state: 'open' }),
      makePullRequest(12, 202, { state: 'closed', merged_at: '2026-03-16T12:00:00Z' }),
    ];
    const relationships: Relationship[] = [
      {
        id: 1,
        issue_id: 1,
        pr_id: 12,
        relationship_type: 'solves',
        confidence: 0.9,
        issue_number: 101,
        pr_number: 202,
      },
    ];

    const projection = projectRepoBoardData(issues, pullRequests, relationships);

    expect(projection.openIssues).toHaveLength(1);
    expect(projection.visiblePullRequests.map((pullRequest) => pullRequest.id)).toEqual([11, 12]);
    expect(projection.visibleRelationships).toHaveLength(1);
    expect(projection.openPullRequestCount).toBe(1);
    expect(projection.trackedPullRequestCount).toBe(2);
  });

  it('filters relationships that point at hidden closed issues', () => {
    const issues = [makeIssue(1, 101, { state: 'closed', closed_at: '2026-03-16T12:00:00Z' })];
    const pullRequests = [makePullRequest(11, 201)];
    const relationships: Relationship[] = [
      {
        id: 1,
        issue_id: 1,
        pr_id: 11,
        relationship_type: 'solves',
        confidence: 1,
        issue_number: 101,
        pr_number: 201,
      },
    ];

    const projection = projectRepoBoardData(issues, pullRequests, relationships);

    expect(projection.openIssues).toHaveLength(0);
    expect(projection.visibleRelationships).toHaveLength(0);
  });
});
