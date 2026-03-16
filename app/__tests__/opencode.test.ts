import { describe, expect, it, vi } from 'vitest';
import {
  buildDuplicateAnalysisBatches,
  buildRelationshipAnalysisBatches,
  chunkItems,
  extractJsonPayload,
  isRetryableOpenCodeError,
  parseModelJsonResponse,
  retryOpenCodeRequest,
} from '../lib/opencode';
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

describe('model JSON parsing', () => {
  it('extracts fenced JSON payloads', () => {
    const payload = extractJsonPayload('```json\n{"matches":[{"issue_number":1}]}\n```');
    expect(payload).toBe('{"matches":[{"issue_number":1}]}');
  });

  it('parses JSON embedded in plain text', () => {
    const parsed = parseModelJsonResponse<{ duplicates: Array<{ issue_number: number }> }>(
      'Here you go:\n{"duplicates":[{"issue_number":1}]}'
    );

    expect(parsed).toEqual({ duplicates: [{ issue_number: 1 }] });
  });
});

describe('OpenCode retries', () => {
  it('retries retryable request failures up to two additional times', async () => {
    const operation = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(Object.assign(new Error('OpenCode Go request timed out after 90 seconds'), { retryable: true }))
      .mockRejectedValueOnce(Object.assign(new Error('network failure'), { retryable: true }))
      .mockResolvedValue('ok');

    await expect(retryOpenCodeRequest(operation, { delayMs: 0 })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable failures', async () => {
    const operation = vi.fn<() => Promise<string>>()
      .mockRejectedValue(new Error('OpenCode Go returned an empty response'));

    await expect(retryOpenCodeRequest(operation, { delayMs: 0 })).rejects.toThrow(
      'OpenCode Go returned an empty response'
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('detects retryable timeout and network errors', () => {
    expect(isRetryableOpenCodeError(new Error('OpenCode Go request timed out after 90 seconds'))).toBe(true);
    expect(isRetryableOpenCodeError(new Error('fetch failed'))).toBe(true);
    expect(isRetryableOpenCodeError(new Error('OpenCode Go returned an empty response'))).toBe(false);
  });
});
