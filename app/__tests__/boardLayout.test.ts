import { describe, it, expect } from 'vitest';
import { buildClusteredNodes, createIssueNode, createPrNode } from '../lib/boardLayout';
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
    labels: '["bug"]',
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
    changed_files: 2,
    draft: 0,
    created_at: null,
    updated_at: null,
    merged_at: null,
    closed_at: null,
  };
}

describe('createIssueNode', () => {
  it('creates a node with correct id and type', () => {
    const issue = makeIssue(42, 100);
    const node = createIssueNode(issue, 'owner/repo', { x: 10, y: 20 });

    expect(node.id).toBe('issue-42');
    expect(node.type).toBe('issue');
    expect(node.position).toEqual({ x: 10, y: 20 });
  });

  it('includes parsed labels in data', () => {
    const issue = makeIssue(1, 10);
    const node = createIssueNode(issue, 'owner/repo', { x: 0, y: 0 });
    const data = node.data as Record<string, unknown>;

    expect(data.labels).toEqual(['bug']);
    expect(data.repo_full_name).toBe('owner/repo');
  });
});

describe('createPrNode', () => {
  it('creates a node with correct id and type', () => {
    const pr = makePR(7, 50);
    const node = createPrNode(pr, 'owner/repo', { x: 100, y: 200 });

    expect(node.id).toBe('pr-7');
    expect(node.type).toBe('pr');
    expect(node.position).toEqual({ x: 100, y: 200 });
  });

  it('includes diff stats in data', () => {
    const pr = makePR(1, 10);
    const node = createPrNode(pr, 'owner/repo', { x: 0, y: 0 });
    const data = node.data as Record<string, unknown>;

    expect(data.additions).toBe(10);
    expect(data.deletions).toBe(5);
    expect(data.changed_files).toBe(2);
    expect(data.draft).toBe(false);
  });
});

describe('buildClusteredNodes', () => {
  it('returns empty array for empty inputs', () => {
    const nodes = buildClusteredNodes([], [], [], 'owner/repo');
    expect(nodes).toHaveLength(0);
  });

  it('creates section header + card nodes for standalone issues', () => {
    const issues = [makeIssue(1, 10), makeIssue(2, 20)];
    const nodes = buildClusteredNodes(issues, [], [], 'owner/repo');

    const header = nodes.find((n) => n.id === 'lane-issues');
    expect(header).toBeDefined();
    expect(header?.type).toBe('lane-header');

    const issueNodes = nodes.filter((n) => n.type === 'issue');
    expect(issueNodes).toHaveLength(2);
  });

  it('creates connected work section with cluster backgrounds', () => {
    const issues = [makeIssue(1, 10)];
    const prs = [makePR(2, 20)];
    const rels: Relationship[] = [
      { id: 1, issue_id: 1, pr_id: 2, relationship_type: 'solves', confidence: 1, issue_number: 10, pr_number: 20 },
    ];

    const nodes = buildClusteredNodes(issues, prs, rels, 'owner/repo');

    const connectedHeader = nodes.find((n) => n.id === 'lane-connected');
    expect(connectedHeader).toBeDefined();

    const clusterBgs = nodes.filter((n) => n.type === 'cluster-group');
    expect(clusterBgs).toHaveLength(1);

    // Should not have standalone sections since all items are linked
    const issueHeader = nodes.find((n) => n.id === 'lane-issues');
    expect(issueHeader).toBeUndefined();
  });

  it('places issue and PR nodes at different x positions within a cluster', () => {
    const issues = [makeIssue(1, 10)];
    const prs = [makePR(2, 20)];
    const rels: Relationship[] = [
      { id: 1, issue_id: 1, pr_id: 2, relationship_type: 'solves', confidence: 1, issue_number: 10, pr_number: 20 },
    ];

    const nodes = buildClusteredNodes(issues, prs, rels, 'owner/repo');
    const issueNode = nodes.find((n) => n.id === 'issue-1');
    const prNode = nodes.find((n) => n.id === 'pr-2');

    expect(issueNode).toBeDefined();
    expect(prNode).toBeDefined();
    // PR should be positioned to the right of the issue
    expect(prNode!.position.x).toBeGreaterThan(issueNode!.position.x);
  });
});
