import { describe, expect, it } from 'vitest';
import {
  buildDuplicateAnalysisBatches,
  buildRelationshipAnalysisBatches,
  chunkItems,
  extractJsonPayload,
  parseCopilotJsonResponse,
} from '../lib/copilot';
import type { Issue, PullRequest } from '../lib/db';

function createIssue(number: number, overrides: Partial<Issue> = {}): Issue {
  return {
    id: number,
    repo_id: 1,
    github_number: number,
    title: `Issue ${number}`,
    body: `Body ${number}`,
    state: 'open',
    author: 'octocat',
    author_avatar: null,
    labels: JSON.stringify([]),
    created_at: null,
    updated_at: null,
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
    body: `Body ${number}`,
    state: 'open',
    author: 'octocat',
    author_avatar: null,
    labels: JSON.stringify([]),
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

describe('chunkItems', () => {
  it('splits items into fixed-size groups', () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('throws for invalid chunk sizes', () => {
    expect(() => chunkItems([1, 2, 3], 0)).toThrow('chunkSize must be greater than zero');
  });
});

describe('relationship batching', () => {
  it('creates bulk PR batches while keeping the smaller issue list together when prompts are too large', () => {
    const issues = Array.from({ length: 2 }, (_, index) => createIssue(index + 1));
    const pullRequests = Array.from({ length: 400 }, (_, index) => createPullRequest(index + 1));

    const batches = buildRelationshipAnalysisBatches(issues, pullRequests, 100);

    expect(batches).toHaveLength(4);
    expect(batches[0].issues).toHaveLength(2);
    expect(batches[0].pullRequests).toHaveLength(100);
    expect(batches[3].issues).toHaveLength(2);
    expect(batches[3].pullRequests).toHaveLength(100);
  });
});

describe('duplicate batching', () => {
  it('creates chunk-pair batches instead of comparing every chunk against the full issue list', () => {
    const issues = Array.from({ length: 400 }, (_, index) => createIssue(index + 1));

    const batches = buildDuplicateAnalysisBatches(issues, 100);

    expect(batches).toHaveLength(10);
    expect(batches[0].primaryIssues).toHaveLength(100);
    expect(batches[0].comparisonIssues).toHaveLength(100);
    expect(batches[9].primaryIssues).toHaveLength(100);
    expect(batches[9].comparisonIssues).toHaveLength(100);
  });
});

describe('Copilot JSON parsing', () => {
  it('extracts fenced JSON payloads', () => {
    const payload = extractJsonPayload('```json\n{"matches":[{"issue_number":1}]}\n```');
    expect(payload).toBe('{"matches":[{"issue_number":1}]}');
  });

  it('parses JSON embedded in plain text', () => {
    const parsed = parseCopilotJsonResponse<{ duplicates: Array<{ issue_number: number }> }>(
      'Here you go:\n{"duplicates":[{"issue_number":1}]}'
    );

    expect(parsed).toEqual({ duplicates: [{ issue_number: 1 }] });
  });
});
