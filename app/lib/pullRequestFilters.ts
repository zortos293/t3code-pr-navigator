import type { Issue, PullRequest } from './db';
import type { Relationship } from './types';
import { parseLabels } from './parseLabels';

export const PULL_REQUEST_SIZE_LABELS = [
  'size:xs',
  'size:s',
  'size:m',
  'size:l',
  'size:xl',
  'size:xxl',
] as const;

export const PULL_REQUEST_VOUCH_STATES = ['trusted', 'unvouched', 'none'] as const;
export const BOARD_VISIBILITY_MODES = ['all', 'issues', 'prs', 'links'] as const;

export type PullRequestSizeLabel = (typeof PULL_REQUEST_SIZE_LABELS)[number];
export type PullRequestVouchState = (typeof PULL_REQUEST_VOUCH_STATES)[number];
export type BoardVisibilityMode = (typeof BOARD_VISIBILITY_MODES)[number];

export type PullRequestFilters = {
  sizes: PullRequestSizeLabel[];
  vouchStates: PullRequestVouchState[];
  visibility: BoardVisibilityMode;
};

type SortablePullRequest = Pick<PullRequest, 'labels' | 'created_at' | 'github_number'>;

const SIZE_PRIORITY = new Map(PULL_REQUEST_SIZE_LABELS.map((label, index) => [label, index]));

export function createEmptyPullRequestFilters(): PullRequestFilters {
  return { sizes: [], vouchStates: [], visibility: 'all' };
}

function getSortableTimestamp(dateStr: string | null): number {
  if (!dateStr) return Number.NEGATIVE_INFINITY;

  const timestamp = new Date(dateStr).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function getNormalizedLabels(labels: string | null): string[] {
  return parseLabels(labels).map((label) => label.toLowerCase());
}

export function getPullRequestSizeLabel(
  pullRequest: Pick<PullRequest, 'labels'>
): PullRequestSizeLabel | null {
  const normalizedLabels = new Set(getNormalizedLabels(pullRequest.labels));

  for (const sizeLabel of PULL_REQUEST_SIZE_LABELS) {
    if (normalizedLabels.has(sizeLabel)) {
      return sizeLabel;
    }
  }

  return null;
}

export function getPullRequestVouchState(
  pullRequest: Pick<PullRequest, 'labels'>
): PullRequestVouchState {
  const normalizedLabels = getNormalizedLabels(pullRequest.labels);

  if (normalizedLabels.includes('vouch:trusted')) return 'trusted';
  if (normalizedLabels.includes('vouch:unvouched')) return 'unvouched';
  return 'none';
}

export function getPullRequestFilterCounts(pullRequests: PullRequest[]): {
  sizes: Record<PullRequestSizeLabel, number>;
  vouchStates: Record<PullRequestVouchState, number>;
} {
  const counts = {
    sizes: {
      'size:xs': 0,
      'size:s': 0,
      'size:m': 0,
      'size:l': 0,
      'size:xl': 0,
      'size:xxl': 0,
    } satisfies Record<PullRequestSizeLabel, number>,
    vouchStates: {
      trusted: 0,
      unvouched: 0,
      none: 0,
    } satisfies Record<PullRequestVouchState, number>,
  };

  for (const pullRequest of pullRequests) {
    const sizeLabel = getPullRequestSizeLabel(pullRequest);
    const vouchState = getPullRequestVouchState(pullRequest);

    if (sizeLabel) {
      counts.sizes[sizeLabel] += 1;
    }
    counts.vouchStates[vouchState] += 1;
  }

  return counts;
}

function getPullRequestVouchPriority(pullRequest: Pick<SortablePullRequest, 'labels'>): number {
  const vouchState = getPullRequestVouchState(pullRequest);

  if (vouchState === 'trusted') return 0;
  if (vouchState === 'unvouched') return 2;
  return 1;
}

function getPullRequestSizePriority(pullRequest: Pick<SortablePullRequest, 'labels'>): number {
  const sizeLabel = getPullRequestSizeLabel(pullRequest);

  if (!sizeLabel) return Number.MAX_SAFE_INTEGER;

  return SIZE_PRIORITY.get(sizeLabel) ?? Number.MAX_SAFE_INTEGER;
}

export function sortPullRequestsForBoard<T extends SortablePullRequest>(pullRequests: T[]): T[] {
  return [...pullRequests].sort((a, b) => {
    const vouchDiff = getPullRequestVouchPriority(a) - getPullRequestVouchPriority(b);
    if (vouchDiff !== 0) return vouchDiff;

    const sizeDiff = getPullRequestSizePriority(a) - getPullRequestSizePriority(b);
    if (sizeDiff !== 0) return sizeDiff;

    const timestampDiff = getSortableTimestamp(b.created_at) - getSortableTimestamp(a.created_at);
    if (timestampDiff !== 0) return timestampDiff;

    return b.github_number - a.github_number;
  });
}

export function hasActivePullRequestFilters(filters: PullRequestFilters): boolean {
  return filters.sizes.length > 0 || filters.vouchStates.length > 0 || filters.visibility !== 'all';
}

export function matchesPullRequestFilters(
  pullRequest: Pick<PullRequest, 'labels'>,
  filters: PullRequestFilters
): boolean {
  const sizeLabel = getPullRequestSizeLabel(pullRequest);
  const vouchState = getPullRequestVouchState(pullRequest);

  const sizeMatches = filters.sizes.length === 0 || (sizeLabel !== null && filters.sizes.includes(sizeLabel));
  const vouchMatches = filters.vouchStates.length === 0 || filters.vouchStates.includes(vouchState);

  return sizeMatches && vouchMatches;
}

export function filterBoardByPullRequestFilters(
  boardData: {
    issues: Issue[];
    pullRequests: PullRequest[];
    relationships: Relationship[];
  },
  filters: PullRequestFilters
): {
  issues: Issue[];
  pullRequests: PullRequest[];
  relationships: Relationship[];
} {
  if (!hasActivePullRequestFilters(filters)) {
    return boardData;
  }

  const hasPullRequestAttributeFilters = filters.sizes.length > 0 || filters.vouchStates.length > 0;
  const attributeMatchedPullRequests = hasPullRequestAttributeFilters
    ? boardData.pullRequests.filter((pullRequest) => matchesPullRequestFilters(pullRequest, filters))
    : boardData.pullRequests;
  const attributeMatchedPrIds = new Set(attributeMatchedPullRequests.map((pullRequest) => pullRequest.id));
  const attributeMatchedRelationships = boardData.relationships.filter((relationship) =>
    attributeMatchedPrIds.has(relationship.pr_id)
  );
  const relatedIssueIds = new Set(attributeMatchedRelationships.map((relationship) => relationship.issue_id));
  const relatedPrIds = new Set(attributeMatchedRelationships.map((relationship) => relationship.pr_id));

  switch (filters.visibility) {
    case 'issues':
      return {
        issues: boardData.issues,
        pullRequests: attributeMatchedPullRequests.filter((pullRequest) => relatedPrIds.has(pullRequest.id)),
        relationships: attributeMatchedRelationships,
      };

    case 'prs':
      return {
        issues: boardData.issues.filter((issue) => relatedIssueIds.has(issue.id)),
        pullRequests: attributeMatchedPullRequests,
        relationships: attributeMatchedRelationships,
      };

    case 'links':
      return {
        issues: boardData.issues.filter((issue) => relatedIssueIds.has(issue.id)),
        pullRequests: attributeMatchedPullRequests.filter((pullRequest) => relatedPrIds.has(pullRequest.id)),
        relationships: attributeMatchedRelationships,
      };

    case 'all':
    default:
      return {
        issues: boardData.issues.filter((issue) => relatedIssueIds.has(issue.id)),
        pullRequests: attributeMatchedPullRequests,
        relationships: attributeMatchedRelationships,
      };
  }
}
