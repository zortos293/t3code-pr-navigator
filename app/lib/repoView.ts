import type { Issue, PullRequest } from './db';
import type { Relationship } from './types';

export type RepoBoardProjection = {
  openIssues: Issue[];
  visiblePullRequests: PullRequest[];
  visibleRelationships: Relationship[];
  openPullRequestCount: number;
  trackedPullRequestCount: number;
};

export function projectRepoBoardData(
  issues: Issue[],
  pullRequests: PullRequest[],
  relationships: Relationship[],
): RepoBoardProjection {
  const openIssues = issues.filter((issue) => issue.state === 'open');
  const linkedPrIds = new Set(relationships.map((relationship) => relationship.pr_id));
  const visiblePullRequests = pullRequests.filter(
    (pullRequest) => pullRequest.state === 'open' || linkedPrIds.has(pullRequest.id),
  );

  const visibleIssueIds = new Set(openIssues.map((issue) => issue.id));
  const visiblePrIds = new Set(visiblePullRequests.map((pullRequest) => pullRequest.id));
  const visibleRelationships = relationships.filter(
    (relationship) =>
      visibleIssueIds.has(relationship.issue_id) && visiblePrIds.has(relationship.pr_id),
  );

  return {
    openIssues,
    visiblePullRequests,
    visibleRelationships,
    openPullRequestCount: pullRequests.filter((pullRequest) => pullRequest.state === 'open').length,
    trackedPullRequestCount: pullRequests.length,
  };
}
