import { describe, it, expect } from 'vitest';
import { parseGitHubUrl, extractIssueReferences } from '../lib/github';

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
