import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

export const nullableString = v.union(v.string(), v.null());

export const repositoryFields = {
  id: v.number(),
  owner: v.string(),
  name: v.string(),
  full_name: v.string(),
  description: nullableString,
  stars: v.number(),
  open_issues_count: v.number(),
  open_prs_count: v.number(),
  created_at: v.string(),
  updated_at: v.string(),
};

export const issueFields = {
  id: v.number(),
  repo_id: v.number(),
  github_number: v.number(),
  title: v.string(),
  body: nullableString,
  state: v.string(),
  author: v.string(),
  author_avatar: nullableString,
  labels: nullableString,
  created_at: nullableString,
  updated_at: nullableString,
  closed_at: nullableString,
};

export const pullRequestFields = {
  id: v.number(),
  repo_id: v.number(),
  github_number: v.number(),
  title: v.string(),
  body: nullableString,
  state: v.string(),
  author: v.string(),
  author_avatar: nullableString,
  labels: nullableString,
  additions: v.number(),
  deletions: v.number(),
  changed_files: v.number(),
  draft: v.number(),
  created_at: nullableString,
  updated_at: nullableString,
  merged_at: nullableString,
  closed_at: nullableString,
};

export const relationshipFields = {
  id: v.number(),
  repo_id: v.number(),
  issue_id: v.number(),
  pr_id: v.number(),
  relationship_type: v.string(),
  confidence: v.number(),
  created_at: v.string(),
};

export const duplicateFields = {
  id: v.number(),
  repo_id: v.number(),
  original_issue_id: v.number(),
  duplicate_issue_id: v.number(),
  confidence: v.number(),
  reason: nullableString,
  created_at: v.string(),
};

export const analysisJobFields = {
  id: v.number(),
  repo_id: v.number(),
  job_type: v.string(),
  status: v.string(),
  progress: v.number(),
  result: nullableString,
  error: nullableString,
  started_at: nullableString,
  completed_at: nullableString,
};

export const activityEventFields = {
  id: v.number(),
  repo_id: v.number(),
  source: v.string(),
  entity_type: v.string(),
  entity_number: v.union(v.number(), v.null()),
  action: v.string(),
  title: nullableString,
  details: nullableString,
  created_at: v.string(),
};

export const commentFields = {
  id: v.number(),
  body: v.string(),
  author: v.string(),
  author_avatar: nullableString,
  created_at: v.string(),
  updated_at: v.string(),
};

export const commentCacheFields = {
  repo_id: v.number(),
  github_number: v.number(),
  comments: v.array(v.object(commentFields)),
  fetched_at: v.string(),
};

export const authSessionFields = {
  token_hash: v.string(),
  expires_at: v.string(),
  created_at: v.string(),
};

type CounterName =
  | 'repositories'
  | 'issues'
  | 'pull_requests'
  | 'issue_pr_relationships'
  | 'duplicate_issues'
  | 'analysis_jobs'
  | 'activity_events';

export type RepositoryDoc = Doc<'repositories'>;
export type IssueDoc = Doc<'issues'>;
export type PullRequestDoc = Doc<'pull_requests'>;
export type RelationshipDoc = Doc<'issue_pr_relationships'>;
export type DuplicateDoc = Doc<'duplicate_issues'>;
export type AnalysisJobDoc = Doc<'analysis_jobs'>;
export type CommentCacheDoc = Doc<'comment_caches'>;
export type ActivityEventDoc = Doc<'activity_events'>;
export type AuthSessionDoc = Doc<'auth_sessions'>;

export type StoredRepository = Omit<RepositoryDoc, '_id' | '_creationTime'>;
export type StoredIssue = Omit<IssueDoc, '_id' | '_creationTime'>;
export type StoredPullRequest = Omit<PullRequestDoc, '_id' | '_creationTime'>;
export type StoredRelationship = Omit<RelationshipDoc, '_id' | '_creationTime'>;
export type StoredDuplicate = Omit<DuplicateDoc, '_id' | '_creationTime'>;
export type StoredAnalysisJob = Omit<AnalysisJobDoc, '_id' | '_creationTime'>;
export type StoredCommentCache = Omit<CommentCacheDoc, '_id' | '_creationTime'>;
export type StoredActivityEvent = Omit<ActivityEventDoc, '_id' | '_creationTime'>;
export type StoredAuthSession = Omit<AuthSessionDoc, '_id' | '_creationTime'>;

async function getCounter(ctx: QueryCtx | MutationCtx, name: CounterName) {
  return ctx.db
    .query('counters')
    .withIndex('by_name', (query) => query.eq('name', name))
    .unique();
}

export async function nextNumericId(ctx: MutationCtx, name: CounterName): Promise<number> {
  const existing = await getCounter(ctx, name);

  if (!existing) {
    await ctx.db.insert('counters', { name, value: 1 });
    return 1;
  }

  const nextValue = existing.value + 1;
  await ctx.db.patch(existing._id, { value: nextValue });
  return nextValue;
}

export async function ensureCounterAtLeast(ctx: MutationCtx, name: CounterName, value: number): Promise<void> {
  const existing = await getCounter(ctx, name);

  if (!existing) {
    await ctx.db.insert('counters', { name, value });
    return;
  }

  if (existing.value < value) {
    await ctx.db.patch(existing._id, { value });
  }
}

export async function getRepositoryByNumericId(ctx: QueryCtx | MutationCtx, id: number) {
  return ctx.db
    .query('repositories')
    .withIndex('by_numeric_id', (query) => query.eq('id', id))
    .unique();
}

export async function getRepositoryByFullName(ctx: QueryCtx | MutationCtx, fullName: string) {
  return ctx.db
    .query('repositories')
    .withIndex('by_full_name', (query) => query.eq('full_name', fullName))
    .unique();
}

export async function getIssueByNumericId(ctx: QueryCtx | MutationCtx, id: number) {
  return ctx.db
    .query('issues')
    .withIndex('by_numeric_id', (query) => query.eq('id', id))
    .unique();
}

export async function getIssueByRepoAndGitHubNumber(
  ctx: QueryCtx | MutationCtx,
  repoId: number,
  githubNumber: number
) {
  return ctx.db
    .query('issues')
    .withIndex('by_repo_and_github_number', (query) =>
      query.eq('repo_id', repoId).eq('github_number', githubNumber)
    )
    .unique();
}

export async function getPullRequestByNumericId(ctx: QueryCtx | MutationCtx, id: number) {
  return ctx.db
    .query('pull_requests')
    .withIndex('by_numeric_id', (query) => query.eq('id', id))
    .unique();
}

export async function getPullRequestByRepoAndGitHubNumber(
  ctx: QueryCtx | MutationCtx,
  repoId: number,
  githubNumber: number
) {
  return ctx.db
    .query('pull_requests')
    .withIndex('by_repo_and_github_number', (query) =>
      query.eq('repo_id', repoId).eq('github_number', githubNumber)
    )
    .unique();
}

export async function getRelationshipByNumericId(ctx: QueryCtx | MutationCtx, id: number) {
  return ctx.db
    .query('issue_pr_relationships')
    .withIndex('by_numeric_id', (query) => query.eq('id', id))
    .unique();
}

export async function getRelationshipByIssueAndPr(
  ctx: QueryCtx | MutationCtx,
  issueId: number,
  prId: number
) {
  return ctx.db
    .query('issue_pr_relationships')
    .withIndex('by_issue_and_pr', (query) => query.eq('issue_id', issueId).eq('pr_id', prId))
    .unique();
}

export async function getDuplicateByPair(
  ctx: QueryCtx | MutationCtx,
  originalIssueId: number,
  duplicateIssueId: number
) {
  return ctx.db
    .query('duplicate_issues')
    .withIndex('by_original_and_duplicate', (query) =>
      query.eq('original_issue_id', originalIssueId).eq('duplicate_issue_id', duplicateIssueId)
    )
    .unique();
}

export async function getAnalysisJobByNumericId(ctx: QueryCtx | MutationCtx, id: number) {
  return ctx.db
    .query('analysis_jobs')
    .withIndex('by_numeric_id', (query) => query.eq('id', id))
    .unique();
}

export async function getCommentCacheByRepoAndGitHubNumber(
  ctx: QueryCtx | MutationCtx,
  repoId: number,
  githubNumber: number
) {
  return ctx.db
    .query('comment_caches')
    .withIndex('by_repo_and_github_number', (query) =>
      query.eq('repo_id', repoId).eq('github_number', githubNumber)
    )
    .unique();
}

export async function upsertRepositoryRecord(ctx: MutationCtx, repository: StoredRepository) {
  const existing = await getRepositoryByNumericId(ctx, repository.id);

  if (existing) {
    await ctx.db.patch(existing._id, repository);
  } else {
    await ctx.db.insert('repositories', repository);
  }

  await ensureCounterAtLeast(ctx, 'repositories', repository.id);
  return repository;
}

export async function upsertIssueRecord(ctx: MutationCtx, issue: StoredIssue) {
  const existing = await getIssueByNumericId(ctx, issue.id);

  if (existing) {
    await ctx.db.patch(existing._id, issue);
  } else {
    await ctx.db.insert('issues', issue);
  }

  await ensureCounterAtLeast(ctx, 'issues', issue.id);
  return issue;
}

export async function upsertPullRequestRecord(ctx: MutationCtx, pullRequest: StoredPullRequest) {
  const existing = await getPullRequestByNumericId(ctx, pullRequest.id);

  if (existing) {
    await ctx.db.patch(existing._id, pullRequest);
  } else {
    await ctx.db.insert('pull_requests', pullRequest);
  }

  await ensureCounterAtLeast(ctx, 'pull_requests', pullRequest.id);
  return pullRequest;
}

export async function upsertRelationshipRecord(ctx: MutationCtx, relationship: StoredRelationship) {
  const existing = await getRelationshipByNumericId(ctx, relationship.id);

  if (existing) {
    await ctx.db.patch(existing._id, relationship);
  } else {
    await ctx.db.insert('issue_pr_relationships', relationship);
  }

  await ensureCounterAtLeast(ctx, 'issue_pr_relationships', relationship.id);
  return relationship;
}

export async function upsertDuplicateRecord(ctx: MutationCtx, duplicate: StoredDuplicate) {
  const existing = await ctx.db
    .query('duplicate_issues')
    .withIndex('by_numeric_id', (query) => query.eq('id', duplicate.id))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, duplicate);
  } else {
    await ctx.db.insert('duplicate_issues', duplicate);
  }

  await ensureCounterAtLeast(ctx, 'duplicate_issues', duplicate.id);
  return duplicate;
}

export async function upsertAnalysisJobRecord(ctx: MutationCtx, analysisJob: StoredAnalysisJob) {
  const existing = await getAnalysisJobByNumericId(ctx, analysisJob.id);

  if (existing) {
    await ctx.db.patch(existing._id, analysisJob);
  } else {
    await ctx.db.insert('analysis_jobs', analysisJob);
  }

  await ensureCounterAtLeast(ctx, 'analysis_jobs', analysisJob.id);
  return analysisJob;
}

export async function upsertCommentCacheRecord(ctx: MutationCtx, commentCache: StoredCommentCache) {
  const existing = await getCommentCacheByRepoAndGitHubNumber(
    ctx,
    commentCache.repo_id,
    commentCache.github_number
  );

  if (existing) {
    await ctx.db.patch(existing._id, commentCache);
  } else {
    await ctx.db.insert('comment_caches', commentCache);
  }

  return commentCache;
}

export async function getActivityEventByNumericId(ctx: QueryCtx | MutationCtx, id: number) {
  return ctx.db
    .query('activity_events')
    .withIndex('by_numeric_id', (query) => query.eq('id', id))
    .unique();
}

export async function upsertActivityEventRecord(ctx: MutationCtx, activityEvent: StoredActivityEvent) {
  const existing = await getActivityEventByNumericId(ctx, activityEvent.id);

  if (existing) {
    await ctx.db.patch(existing._id, activityEvent);
  } else {
    await ctx.db.insert('activity_events', activityEvent);
  }

  await ensureCounterAtLeast(ctx, 'activity_events', activityEvent.id);
  return activityEvent;
}

export async function getAuthSessionByTokenHash(ctx: QueryCtx | MutationCtx, tokenHash: string) {
  return ctx.db
    .query('auth_sessions')
    .withIndex('by_token_hash', (query) => query.eq('token_hash', tokenHash))
    .unique();
}

export async function upsertAuthSessionRecord(ctx: MutationCtx, authSession: StoredAuthSession) {
  const existing = await getAuthSessionByTokenHash(ctx, authSession.token_hash);

  if (existing) {
    await ctx.db.patch(existing._id, authSession);
  } else {
    await ctx.db.insert('auth_sessions', authSession);
  }

  return authSession;
}
