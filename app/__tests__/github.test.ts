import { describe, it, expect } from 'vitest';
import type { Issue, PullRequest } from '../lib/db';
import {
  buildClosedIssueUpdates,
  buildClosedPullRequestUpdates,
  parseGitHubUrl,
  extractIssueReferences,
} from '../lib/github';

describe('parseGitHubUrl', () => {
  it('parses a full GitHub URL', () => {
    const result = parseGitHubUrl('https://github.com/pingdotgg/t3code');
    expect(result).toEqual({ owner: 'pingdotgg', name: 't3code' });
  });

  it('parses a GitHub URL with .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo.git');
    expect(result).toEqual({ owner: 'owner', name: 'repo' });
  });

  it('parses owner/name shorthand', () => {
    const result = parseGitHubUrl('facebook/react');
    expect(result).toEqual({ owner: 'facebook', name: 'react' });
  });

  it('parses URLs with additional path segments', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/issues/123');
    expect(result).toEqual({ owner: 'owner', name: 'repo' });
  });

  it('returns null for invalid URLs', () => {
    expect(parseGitHubUrl('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseGitHubUrl('')).toBeNull();
  });
});

describe('extractIssueReferences', () => {
  it('extracts "fixes #123"', () => {
    const result = extractIssueReferences('fixes #123');
    expect(result).toEqual([{ issueNumber: 123, type: 'solves' }]);
  });

  it('extracts "closes #456"', () => {
    const result = extractIssueReferences('closes #456');
    expect(result).toEqual([{ issueNumber: 456, type: 'solves' }]);
  });

  it('extracts "resolves #789"', () => {
    const result = extractIssueReferences('resolves #789');
    expect(result).toEqual([{ issueNumber: 789, type: 'solves' }]);
  });

  it('extracts "relates to #100"', () => {
    const result = extractIssueReferences('relates to #100');
    expect(result).toEqual([{ issueNumber: 100, type: 'relates' }]);
  });

  it('extracts "refs #200"', () => {
    const result = extractIssueReferences('refs #200');
    expect(result).toEqual([{ issueNumber: 200, type: 'relates' }]);
  });

  it('extracts "supersedes #921"', () => {
    const result = extractIssueReferences('Supersedes #921');
    expect(result).toEqual([{ issueNumber: 921, type: 'supersedes' }]);
  });

  it('extracts common supersedes misspellings', () => {
    const result = extractIssueReferences('superseeds #88 and supercedes #89');
    expect(result).toContainEqual({ issueNumber: 88, type: 'supersedes' });
    expect(result).toContainEqual({ issueNumber: 89, type: 'supersedes' });
  });

  it('extracts multiple references from one text', () => {
    const result = extractIssueReferences('fixes #10 and relates to #20');
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ issueNumber: 10, type: 'solves' });
    expect(result).toContainEqual({ issueNumber: 20, type: 'relates' });
  });

  it('deduplicates references to the same issue', () => {
    const result = extractIssueReferences('fixes #10 also fixes #10');
    expect(result).toHaveLength(1);
  });

  it('extracts full GitHub issue URLs', () => {
    const result = extractIssueReferences(
      'fixes https://github.com/owner/repo/issues/42'
    );
    expect(result).toEqual([{ issueNumber: 42, type: 'solves' }]);
  });

  it('returns empty array when no references found', () => {
    expect(extractIssueReferences('no references here')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractIssueReferences('')).toEqual([]);
  });

  it('is case-insensitive', () => {
    const result = extractIssueReferences('FIXES #123');
    expect(result).toEqual([{ issueNumber: 123, type: 'solves' }]);
  });
});

function createIssue(number: number, overrides: Partial<Issue> = {}): Issue {
  return {
    id: number,
    repo_id: 1,
    github_number: number,
    title: `Issue ${number}`,
    body: null,
    state: 'open',
    author: 'octocat',
    author_avatar: null,
    labels: null,
    created_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    closed_at: null,
    ...overrides,
  };
}

function createPullRequest(number: number, overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: number,
    repo_id: 1,
    github_number: number,
    title: `PR ${number}`,
    body: null,
    state: 'open',
    author: 'octocat',
    author_avatar: null,
    labels: null,
    additions: 0,
    deletions: 0,
    changed_files: 0,
    draft: 0,
    created_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    merged_at: null,
    closed_at: null,
    ...overrides,
  };
}

describe('sync closing helpers', () => {
  it('marks tracked issues missing from the latest open sync as closed', () => {
    const syncedAt = '2026-03-16T00:00:00.000Z';
    const updates = buildClosedIssueUpdates(
      [createIssue(1), createIssue(2), createIssue(3, { state: 'closed', closed_at: '2026-02-01T00:00:00.000Z' })],
      new Set([1]),
      syncedAt
    );

    expect(updates).toEqual([
      expect.objectContaining({
        github_number: 2,
        state: 'closed',
        updated_at: syncedAt,
        closed_at: syncedAt,
      }),
    ]);
  });

  it('marks tracked pull requests missing from the latest open sync as closed', () => {
    const syncedAt = '2026-03-16T00:00:00.000Z';
    const updates = buildClosedPullRequestUpdates(
      [createPullRequest(10), createPullRequest(11, { state: 'closed', closed_at: '2026-02-01T00:00:00.000Z' })],
      new Set<number>(),
      syncedAt
    );

    expect(updates).toEqual([
      expect.objectContaining({
        github_number: 10,
        state: 'closed',
        updated_at: syncedAt,
        closed_at: syncedAt,
      }),
    ]);
  });
});
