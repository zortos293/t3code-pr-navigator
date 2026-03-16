import type { Issue, PullRequest } from './db';
import type { DetailItem } from './types';
import { parseLabels } from './parseLabels';

export type SearchResult = {
  key: string;
  kind: 'issue' | 'pr';
  nodeId: string;
  githubNumber: number;
  title: string;
  subtitle: string;
  detail: DetailItem;
  score: number;
};

type SearchableFieldSet = {
  title: string;
  body: string;
  author: string;
  labels: string[];
  githubNumber: number;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function scoreMatch(query: string, queryNumber: string | null, fields: SearchableFieldSet): number {
  const normalizedTitle = normalize(fields.title);
  const normalizedBody = normalize(fields.body);
  const normalizedAuthor = normalize(fields.author);
  const normalizedLabels = fields.labels.map(normalize);
  const githubNumber = String(fields.githubNumber);

  let score = 0;

  if (queryNumber) {
    if (githubNumber === queryNumber) score += 1000;
    else if (githubNumber.startsWith(queryNumber)) score += 350;
  }

  if (normalizedTitle === query) score += 700;
  else if (normalizedTitle.startsWith(query)) score += 450;
  else if (normalizedTitle.includes(query)) score += 250;

  if (normalizedLabels.some((label) => label === query)) score += 220;
  else if (normalizedLabels.some((label) => label.includes(query))) score += 150;

  if (normalizedAuthor === query) score += 120;
  else if (normalizedAuthor.includes(query)) score += 80;

  if (normalizedBody.includes(query)) score += 40;

  return score;
}

export function searchBoardItems(
  query: string,
  issues: Issue[],
  pullRequests: PullRequest[]
): SearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const queryNumberMatch = normalizedQuery.match(/^#?(\d+)$/);
  const queryNumber = queryNumberMatch?.[1] ?? null;

  const issueResults = issues
    .map((issue) => {
      const score = scoreMatch(normalizedQuery, queryNumber, {
        title: issue.title,
        body: issue.body ?? '',
        author: issue.author,
        labels: parseLabels(issue.labels),
        githubNumber: issue.github_number,
      });

      if (score === 0) return null;

      return {
        key: `issue-${issue.id}`,
        kind: 'issue' as const,
        nodeId: `issue-${issue.id}`,
        githubNumber: issue.github_number,
        title: issue.title,
        subtitle: issue.author,
        detail: { type: 'issue', item: issue } satisfies DetailItem,
        score,
      };
    })
    .filter(isPresent);

  const prResults = pullRequests
    .map((pr) => {
      const score = scoreMatch(normalizedQuery, queryNumber, {
        title: pr.title,
        body: pr.body ?? '',
        author: pr.author,
        labels: parseLabels(pr.labels),
        githubNumber: pr.github_number,
      });

      if (score === 0) return null;

      return {
        key: `pr-${pr.id}`,
        kind: 'pr' as const,
        nodeId: `pr-${pr.id}`,
        githubNumber: pr.github_number,
        title: pr.title,
        subtitle: pr.author,
        detail: { type: 'pr', item: pr } satisfies DetailItem,
        score,
      };
    })
    .filter(isPresent);

  return [...issueResults, ...prResults].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.githubNumber !== b.githubNumber) return b.githubNumber - a.githubNumber;
    return a.title.localeCompare(b.title);
  });
}
