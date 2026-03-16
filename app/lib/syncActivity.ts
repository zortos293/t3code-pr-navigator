import type { Issue, PullRequest } from './db';

type SyncIssue = {
  number: number;
  title: string;
  state: string;
};

type SyncPullRequest = {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
};

export type ActivityEventDraft = {
  entity_type: 'issue' | 'pr' | 'sync';
  action: 'added' | 'reopened' | 'closed' | 'merged' | 'completed';
  entity_number: number | null;
  title: string | null;
  details: string | null;
};

type BuildSyncActivityInput = {
  existingIssues: Issue[];
  existingPullRequests: PullRequest[];
  nextIssues: SyncIssue[];
  nextPullRequests: SyncPullRequest[];
};

type SyncSummary = {
  addedIssues: number;
  reopenedIssues: number;
  closedIssues: number;
  addedPullRequests: number;
  reopenedPullRequests: number;
  mergedPullRequests: number;
  closedPullRequests: number;
  openIssues: number;
  openPullRequests: number;
  trackedPullRequests: number;
};

function countEvents(events: ActivityEventDraft[], entityType: 'issue' | 'pr', action: ActivityEventDraft['action']) {
  return events.filter((event) => event.entity_type === entityType && event.action === action).length;
}

export function buildSyncActivityEvents({
  existingIssues,
  existingPullRequests,
  nextIssues,
  nextPullRequests,
}: BuildSyncActivityInput): ActivityEventDraft[] {
  const events: ActivityEventDraft[] = [];
  const existingIssueMap = new Map(existingIssues.map((issue) => [issue.github_number, issue]));
  const existingPullRequestMap = new Map(
    existingPullRequests.map((pullRequest) => [pullRequest.github_number, pullRequest]),
  );

  for (const issue of nextIssues) {
    const previous = existingIssueMap.get(issue.number);

    if (!previous) {
      if (issue.state === 'open') {
        events.push({
          entity_type: 'issue',
          action: 'added',
          entity_number: issue.number,
          title: issue.title,
          details: null,
        });
      }
      continue;
    }

    if (previous.state !== issue.state) {
      events.push({
        entity_type: 'issue',
        action: issue.state === 'open' ? 'reopened' : 'closed',
        entity_number: issue.number,
        title: issue.title,
        details: null,
      });
    }
  }

  for (const pullRequest of nextPullRequests) {
    const previous = existingPullRequestMap.get(pullRequest.number);

    if (!previous) {
      if (pullRequest.state === 'open') {
        events.push({
          entity_type: 'pr',
          action: 'added',
          entity_number: pullRequest.number,
          title: pullRequest.title,
          details: null,
        });
      }
      continue;
    }

    if (previous.state === pullRequest.state) {
      continue;
    }

    let action: ActivityEventDraft['action'];
    if (pullRequest.state === 'open') {
      action = 'reopened';
    } else if (pullRequest.merged_at) {
      action = 'merged';
    } else {
      action = 'closed';
    }

    events.push({
      entity_type: 'pr',
      action,
      entity_number: pullRequest.number,
      title: pullRequest.title,
      details: null,
    });
  }

  return events;
}

export function buildSyncSummaryEvent(
  events: ActivityEventDraft[],
  openIssues: number,
  openPullRequests: number,
  trackedPullRequests: number,
): ActivityEventDraft {
  const details: SyncSummary = {
    addedIssues: countEvents(events, 'issue', 'added'),
    reopenedIssues: countEvents(events, 'issue', 'reopened'),
    closedIssues: countEvents(events, 'issue', 'closed'),
    addedPullRequests: countEvents(events, 'pr', 'added'),
    reopenedPullRequests: countEvents(events, 'pr', 'reopened'),
    mergedPullRequests: countEvents(events, 'pr', 'merged'),
    closedPullRequests: countEvents(events, 'pr', 'closed'),
    openIssues,
    openPullRequests,
    trackedPullRequests,
  };

  return {
    entity_type: 'sync',
    action: 'completed',
    entity_number: null,
    title: 'Sync completed',
    details: JSON.stringify(details),
  };
}
