import { describe, expect, it } from 'vitest';
import type { Issue, PullRequest } from '../lib/db';
import { searchBoardItems } from '../lib/search';

function makeIssue(id: number, githubNumber: number, overrides: Partial<Issue> = {}): Issue {
  return {
    id,
    repo_id: 1,
    github_number: githubNumber,
    title: `Issue #${githubNumber}`,
    body: null,
    state: 'open',
    author: 'issue-author',
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
    author: 'pr-author',
    author_avatar: null,
    labels: null,
    additions: 1,
    deletions: 1,
    changed_files: 1,
    draft: 0,
    created_at: null,
    updated_at: null,
    merged_at: null,
    closed_at: null,
    ...overrides,
  };
}

describe('searchBoardItems', () => {
  it('returns empty results for an empty query', () => {
    expect(searchBoardItems('   ', [], [])).toEqual([]);
  });

  it('prioritizes exact number matches across issues and pull requests', () => {
    const results = searchBoardItems(
      '#42',
      [makeIssue(1, 42, { title: 'Keyboard navigation bug' })],
      [makePullRequest(2, 420, { title: 'Refine search bar spacing' })]
    );

    expect(results[0]).toMatchObject({
      kind: 'issue',
      githubNumber: 42,
      nodeId: 'issue-1',
    });
  });

  it('searches titles, labels, and author names', () => {
    const results = searchBoardItems(
      'triage',
      [
        makeIssue(1, 10, {
          title: 'Polish dashboard',
          labels: '["triage"]',
        }),
      ],
      [
        makePullRequest(2, 20, {
          title: 'Implement advanced filter',
          author: 'triage-bot',
        }),
      ]
    );

    expect(results.map((result) => result.nodeId)).toEqual(['issue-1', 'pr-2']);
  });

  it('returns detail payloads that identify the selected board item', () => {
    const [result] = searchBoardItems(
      'search',
      [],
      [makePullRequest(5, 77, { title: 'Add search functionality' })]
    );

    expect(result.detail).toMatchObject({
      type: 'pr',
      item: {
        id: 5,
        github_number: 77,
      },
    });
  });
});
