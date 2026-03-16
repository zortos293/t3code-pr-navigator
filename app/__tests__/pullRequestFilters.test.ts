import { describe, expect, it } from 'vitest';
import type { Issue, PullRequest } from '../lib/db';
import type { Relationship } from '../lib/types';
import {
  createEmptyPullRequestFilters,
  filterBoardByPullRequestFilters,
  getPullRequestFilterCounts,
  matchesPullRequestFilters,
} from '../lib/pullRequestFilters';

function makeIssue(id: number, github_number: number, overrides: Partial<Issue> = {}): Issue {
  return {
    id,
    repo_id: 1,
    github_number,
    title: `Issue #${github_number}`,
    body: null,
    state: 'open',
    author: 'user',
    author_avatar: null,
    labels: '["bug"]',
    created_at: null,
    updated_at: null,
    closed_at: null,
    ...overrides,
  };
}

function makePR(id: number, github_number: number, overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id,
    repo_id: 1,
    github_number,
    title: `PR #${github_number}`,
    body: null,
    state: 'open',
    author: 'user',
    author_avatar: null,
    labels: null,
    additions: 10,
    deletions: 5,
    changed_files: 2,
    draft: 0,
    created_at: null,
    updated_at: null,
    merged_at: null,
    closed_at: null,
    ...overrides,
  };
}

describe('pullRequestFilters', () => {
  it('returns original board data when no filters are active', () => {
    const boardData = {
      issues: [makeIssue(1, 10)],
      pullRequests: [makePR(2, 20)],
      relationships: [] as Relationship[],
    };

    const result = filterBoardByPullRequestFilters(boardData, createEmptyPullRequestFilters());

    expect(result.issues).toBe(boardData.issues);
    expect(result.pullRequests).toBe(boardData.pullRequests);
    expect(result.relationships).toBe(boardData.relationships);
  });

  it('filters PRs by size and removes unrelated issue cards', () => {
    const issues = [makeIssue(1, 10), makeIssue(2, 20)];
    const pullRequests = [
      makePR(11, 101, { labels: '["size:s","vouch:trusted"]' }),
      makePR(12, 102, { labels: '["size:l","vouch:trusted"]' }),
      makePR(13, 103, { labels: '["size:s"]' }),
    ];
    const relationships: Relationship[] = [
      { id: 1, issue_id: 1, pr_id: 11, relationship_type: 'solves', confidence: 1, issue_number: 10, pr_number: 101 },
      { id: 2, issue_id: 2, pr_id: 12, relationship_type: 'solves', confidence: 1, issue_number: 20, pr_number: 102 },
    ];

    const result = filterBoardByPullRequestFilters(
      { issues, pullRequests, relationships },
      { sizes: ['size:s'], vouchStates: [], visibility: 'all' }
    );

    expect(result.pullRequests.map((pullRequest) => pullRequest.id)).toEqual([11, 13]);
    expect(result.relationships.map((relationship) => relationship.id)).toEqual([1]);
    expect(result.issues.map((issue) => issue.id)).toEqual([1]);
  });

  it('supports combining vouch and size filters', () => {
    const trustedLarge = makePR(1, 10, { labels: '["vouch:trusted","size:l"]' });
    const trustedSmall = makePR(2, 20, { labels: '["vouch:trusted","size:s"]' });
    const unvouchedLarge = makePR(3, 30, { labels: '["vouch:unvouched","size:l"]' });

    expect(
      matchesPullRequestFilters(trustedLarge, {
        sizes: ['size:l'],
        vouchStates: ['trusted'],
        visibility: 'all',
      })
    ).toBe(true);
    expect(
      matchesPullRequestFilters(trustedSmall, {
        sizes: ['size:l'],
        vouchStates: ['trusted'],
        visibility: 'all',
      })
    ).toBe(false);
    expect(
      matchesPullRequestFilters(unvouchedLarge, {
        sizes: ['size:l'],
        vouchStates: ['trusted'],
        visibility: 'all',
      })
    ).toBe(false);
  });

  it('counts available size and vouch options from PR labels', () => {
    const counts = getPullRequestFilterCounts([
      makePR(1, 10, { labels: '["vouch:trusted","size:xs"]' }),
      makePR(2, 20, { labels: '["vouch:trusted","size:l"]' }),
      makePR(3, 30, { labels: '["vouch:unvouched","size:l"]' }),
      makePR(4, 40, { labels: null }),
    ]);

    expect(counts.sizes['size:xs']).toBe(1);
    expect(counts.sizes['size:l']).toBe(2);
    expect(counts.vouchStates.trusted).toBe(2);
    expect(counts.vouchStates.unvouched).toBe(1);
    expect(counts.vouchStates.none).toBe(1);
  });

  it('shows all issues but only connected PR context in issues focus mode', () => {
    const issues = [makeIssue(1, 10), makeIssue(2, 20)];
    const pullRequests = [
      makePR(11, 101, { labels: '["size:s","vouch:trusted"]' }),
      makePR(12, 102, { labels: '["size:l","vouch:trusted"]' }),
      makePR(13, 103, { labels: '["size:s"]' }),
    ];
    const relationships: Relationship[] = [
      { id: 1, issue_id: 1, pr_id: 11, relationship_type: 'solves', confidence: 1, issue_number: 10, pr_number: 101 },
      { id: 2, issue_id: 2, pr_id: 12, relationship_type: 'supersedes', confidence: 1, issue_number: 20, pr_number: 102 },
    ];

    const result = filterBoardByPullRequestFilters(
      { issues, pullRequests, relationships },
      { sizes: [], vouchStates: [], visibility: 'issues' }
    );

    expect(result.issues.map((issue) => issue.id)).toEqual([1, 2]);
    expect(result.pullRequests.map((pullRequest) => pullRequest.id)).toEqual([11, 12]);
    expect(result.relationships.map((relationship) => relationship.id)).toEqual([1, 2]);
  });

  it('shows only connected cards in links mode after PR filters are applied', () => {
    const issues = [makeIssue(1, 10), makeIssue(2, 20)];
    const pullRequests = [
      makePR(11, 101, { labels: '["size:s","vouch:trusted"]' }),
      makePR(12, 102, { labels: '["size:l","vouch:trusted"]' }),
      makePR(13, 103, { labels: '["size:s"]' }),
    ];
    const relationships: Relationship[] = [
      { id: 1, issue_id: 1, pr_id: 11, relationship_type: 'solves', confidence: 1, issue_number: 10, pr_number: 101 },
      { id: 2, issue_id: 2, pr_id: 12, relationship_type: 'relates', confidence: 0.7, issue_number: 20, pr_number: 102 },
    ];

    const result = filterBoardByPullRequestFilters(
      { issues, pullRequests, relationships },
      { sizes: ['size:s'], vouchStates: ['trusted'], visibility: 'links' }
    );

    expect(result.issues.map((issue) => issue.id)).toEqual([1]);
    expect(result.pullRequests.map((pullRequest) => pullRequest.id)).toEqual([11]);
    expect(result.relationships.map((relationship) => relationship.id)).toEqual([1]);
  });
});
