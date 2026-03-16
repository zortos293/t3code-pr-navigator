import { describe, it, expect } from 'vitest';
import { buildClusters } from '../lib/clustering';
import type { Issue, PullRequest } from '../lib/db';
import type { Relationship } from '../lib/types';

function makeIssue(id: number, github_number: number): Issue {
  return {
    id,
    repo_id: 1,
    github_number,
    title: `Issue #${github_number}`,
    body: null,
    state: 'open',
    author: 'user',
    author_avatar: null,
    labels: null,
    created_at: null,
    updated_at: null,
    closed_at: null,
  };
}

function makePR(id: number, github_number: number): PullRequest {
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
    changed_files: 3,
    draft: 0,
    created_at: null,
    updated_at: null,
    merged_at: null,
    closed_at: null,
  };
}

function makeRel(id: number, issue_id: number, pr_id: number, issue_number: number, pr_number: number): Relationship {
  return {
    id,
    issue_id,
    pr_id,
    relationship_type: 'solves',
    confidence: 1.0,
    issue_number,
    pr_number,
  };
}

describe('buildClusters', () => {
  it('returns all items as standalone when there are no relationships', () => {
    const issues = [makeIssue(1, 10), makeIssue(2, 20)];
    const prs = [makePR(3, 30)];

    const result = buildClusters(issues, prs, []);

    expect(result.clusters).toHaveLength(0);
    expect(result.standaloneIssues).toHaveLength(2);
    expect(result.standalonePrs).toHaveLength(1);
  });

  it('groups a single issue-PR pair into one cluster', () => {
    const issues = [makeIssue(1, 10)];
    const prs = [makePR(2, 20)];
    const rels = [makeRel(1, 1, 2, 10, 20)];

    const result = buildClusters(issues, prs, rels);

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].issues).toHaveLength(1);
    expect(result.clusters[0].prs).toHaveLength(1);
    expect(result.standaloneIssues).toHaveLength(0);
    expect(result.standalonePrs).toHaveLength(0);
  });

  it('merges transitively connected items into one cluster', () => {
    const issues = [makeIssue(1, 10), makeIssue(2, 20)];
    const prs = [makePR(3, 30)];
    // Both issues linked to the same PR
    const rels = [
      makeRel(1, 1, 3, 10, 30),
      makeRel(2, 2, 3, 20, 30),
    ];

    const result = buildClusters(issues, prs, rels);

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].issues).toHaveLength(2);
    expect(result.clusters[0].prs).toHaveLength(1);
  });

  it('creates separate clusters for unconnected groups', () => {
    const issues = [makeIssue(1, 10), makeIssue(2, 20)];
    const prs = [makePR(3, 30), makePR(4, 40)];
    const rels = [
      makeRel(1, 1, 3, 10, 30),
      makeRel(2, 2, 4, 20, 40),
    ];

    const result = buildClusters(issues, prs, rels);

    expect(result.clusters).toHaveLength(2);
    expect(result.standaloneIssues).toHaveLength(0);
    expect(result.standalonePrs).toHaveLength(0);
  });

  it('sorts clusters by latest activity before size', () => {
    const issues = [
      { ...makeIssue(1, 10), created_at: '2024-01-01T00:00:00Z' },
      { ...makeIssue(2, 20), created_at: '2024-02-01T00:00:00Z' },
      { ...makeIssue(3, 30), created_at: '2024-03-01T00:00:00Z' },
    ];
    const prs = [
      { ...makePR(4, 40), created_at: '2024-01-15T00:00:00Z' },
      { ...makePR(5, 50), created_at: '2024-03-15T00:00:00Z' },
    ];
    // Cluster 1: issue 1 + pr 4 (2 items)
    // Cluster 2: issues 2,3 + pr 5 (3 items)
    const rels = [
      makeRel(1, 1, 4, 10, 40),
      makeRel(2, 2, 5, 20, 50),
      makeRel(3, 3, 5, 30, 50),
    ];

    const result = buildClusters(issues, prs, rels);

    expect(result.clusters).toHaveLength(2);
    expect(result.clusters[0].prs[0].github_number).toBe(50);
    expect(result.clusters[1].prs[0].github_number).toBe(40);
  });

  it('handles relationships referencing non-existent items', () => {
    const issues = [makeIssue(1, 10)];
    const prs = [makePR(2, 20)];
    // Relationship references an issue that doesn't exist
    const rels = [makeRel(1, 999, 2, 999, 20)];

    const result = buildClusters(issues, prs, rels);

    expect(result.clusters).toHaveLength(0);
    expect(result.standaloneIssues).toHaveLength(1);
    expect(result.standalonePrs).toHaveLength(1);
  });

  it('returns empty results for empty inputs', () => {
    const result = buildClusters([], [], []);

    expect(result.clusters).toHaveLength(0);
    expect(result.standaloneIssues).toHaveLength(0);
    expect(result.standalonePrs).toHaveLength(0);
  });
});
