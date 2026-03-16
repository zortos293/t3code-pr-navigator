import { describe, expect, it } from 'vitest';
import { buildSyncActivityEvents, buildSyncSummaryEvent } from '../lib/syncActivity';
import type { Issue, PullRequest } from '../lib/db';

function makeIssue(number: number, overrides: Partial<Issue> = {}): Issue {
  return {
    id: number,
    repo_id: 1,
    github_number: number,
    title: `Issue #${number}`,
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

function makePullRequest(number: number, overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: number,
    repo_id: 1,
    github_number: number,
    title: `PR #${number}`,
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

describe('buildSyncActivityEvents', () => {
  it('captures new issues and reopened issues', () => {
    const events = buildSyncActivityEvents({
      existingIssues: [makeIssue(101, { state: 'closed' })],
      existingPullRequests: [],
      nextIssues: [
        { number: 101, title: 'Issue #101', state: 'open' },
        { number: 102, title: 'Issue #102', state: 'open' },
      ],
      nextPullRequests: [],
    });

    expect(events).toEqual([
      {
        entity_type: 'issue',
        action: 'reopened',
        entity_number: 101,
        title: 'Issue #101',
        details: null,
      },
      {
        entity_type: 'issue',
        action: 'added',
        entity_number: 102,
        title: 'Issue #102',
        details: null,
      },
    ]);
  });

  it('captures merged and newly opened pull requests', () => {
    const events = buildSyncActivityEvents({
      existingIssues: [],
      existingPullRequests: [makePullRequest(201, { state: 'open' })],
      nextIssues: [],
      nextPullRequests: [
        { number: 201, title: 'PR #201', state: 'closed', merged_at: '2026-03-16T12:00:00Z' },
        { number: 202, title: 'PR #202', state: 'open', merged_at: null },
      ],
    });

    expect(events).toEqual([
      {
        entity_type: 'pr',
        action: 'merged',
        entity_number: 201,
        title: 'PR #201',
        details: null,
      },
      {
        entity_type: 'pr',
        action: 'added',
        entity_number: 202,
        title: 'PR #202',
        details: null,
      },
    ]);
  });
});

describe('buildSyncSummaryEvent', () => {
  it('rolls activity counts into a sync summary payload', () => {
    const summary = buildSyncSummaryEvent(
      [
        { entity_type: 'issue', action: 'added', entity_number: 101, title: 'Issue #101', details: null },
        { entity_type: 'pr', action: 'merged', entity_number: 201, title: 'PR #201', details: null },
      ],
      4,
      3,
      9,
    );

    expect(summary.entity_type).toBe('sync');
    expect(summary.action).toBe('completed');
    expect(summary.title).toBe('Sync completed');
    expect(JSON.parse(summary.details || '{}')).toMatchObject({
      addedIssues: 1,
      mergedPullRequests: 1,
      openIssues: 4,
      openPullRequests: 3,
      trackedPullRequests: 9,
    });
  });
});
