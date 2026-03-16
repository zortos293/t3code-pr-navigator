import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export type Repository = {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  open_issues_count: number;
  open_prs_count: number;
  created_at: string;
  updated_at: string;
};

export type Issue = {
  id: number;
  repo_id: number;
  github_number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  author_avatar: string | null;
  labels: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
};

export type PullRequest = {
  id: number;
  repo_id: number;
  github_number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  author_avatar: string | null;
  labels: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  draft: number;
  created_at: string | null;
  updated_at: string | null;
  merged_at: string | null;
  closed_at: string | null;
};

export type IssueRelationship = {
  id: number;
  repo_id: number;
  issue_id: number;
  pr_id: number;
  relationship_type: string;
  confidence: number;
  created_at: string;
};

export type DuplicateIssue = {
  id: number;
  repo_id: number;
  original_issue_id: number;
  duplicate_issue_id: number;
  confidence: number;
  reason: string | null;
  created_at: string;
};

export type AnalysisJob = {
  id: number;
  repo_id: number;
  job_type: string;
  status: string;
  progress: number;
  result: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type ActivityEvent = {
  id: number;
  repo_id: number;
  source: string;
  entity_type: string;
  entity_number: number | null;
  action: string;
  title: string | null;
  details: string | null;
  created_at: string;
};

export type CachedComment = {
  id: number;
  body: string;
  author: string;
  author_avatar: string | null;
  created_at: string;
  updated_at: string;
};

export type CommentCache = {
  repo_id: number;
  github_number: number;
  comments: CachedComment[];
  fetched_at: string;
};

export type AuthSession = {
  token_hash: string;
  expires_at: string;
  created_at: string;
};

type RelationshipWithNumbers = IssueRelationship & { issue_number: number; pr_number: number };
type DuplicateWithNumbers = DuplicateIssue & { original_number: number; duplicate_number: number };

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export const repos = {
  getAll(): Promise<Repository[]> {
    return fetchQuery(api.repos.getAll, {});
  },

  async getById(id: number): Promise<Repository | undefined> {
    return (await fetchQuery(api.repos.getById, { id })) ?? undefined;
  },

  async getByFullName(fullName: string): Promise<Repository | undefined> {
    return (await fetchQuery(api.repos.getByFullName, { full_name: fullName })) ?? undefined;
  },

  create(repo: Omit<Repository, 'id' | 'created_at' | 'updated_at'>): Promise<Repository> {
    return fetchMutation(api.repos.create, repo);
  },

  update(id: number, data: Partial<Omit<Repository, 'id' | 'created_at'>>): Promise<Repository> {
    return fetchMutation(api.repos.update, {
      id,
      patch: stripUndefined(data),
    });
  },

  delete(id: number): Promise<boolean> {
    return fetchMutation(api.repos.remove, { id });
  },
};

export const issues = {
  getByRepoId(repoId: number): Promise<Issue[]> {
    return fetchQuery(api.issues.getByRepoId, { repo_id: repoId });
  },

  getOpenByRepoId(repoId: number): Promise<Issue[]> {
    return fetchQuery(api.issues.getOpenByRepoId, { repo_id: repoId });
  },

  async getById(id: number): Promise<Issue | undefined> {
    return (await fetchQuery(api.issues.getById, { id })) ?? undefined;
  },

  upsert(issue: Omit<Issue, 'id'>): Promise<Issue> {
    return fetchMutation(api.issues.upsert, { issue });
  },

  deleteByRepoId(repoId: number): Promise<boolean> {
    return fetchMutation(api.issues.deleteByRepoId, { repo_id: repoId });
  },
};

export const pullRequests = {
  getByRepoId(repoId: number): Promise<PullRequest[]> {
    return fetchQuery(api.pullRequests.getByRepoId, { repo_id: repoId });
  },

  async getById(id: number): Promise<PullRequest | undefined> {
    return (await fetchQuery(api.pullRequests.getById, { id })) ?? undefined;
  },

  upsert(pullRequest: Omit<PullRequest, 'id'>): Promise<PullRequest> {
    return fetchMutation(api.pullRequests.upsert, { pullRequest });
  },

  deleteByRepoId(repoId: number): Promise<boolean> {
    return fetchMutation(api.pullRequests.deleteByRepoId, { repo_id: repoId });
  },
};

export const relationships = {
  getByRepoId(repoId: number): Promise<RelationshipWithNumbers[]> {
    return fetchQuery(api.relationships.getByRepoId, { repo_id: repoId });
  },

  getAll(): Promise<RelationshipWithNumbers[]> {
    return fetchQuery(api.relationships.getAll, {});
  },

  create(rel: { issue_id: number; pr_id: number; relationship_type?: string; confidence?: number }): Promise<IssueRelationship> {
    return fetchMutation(api.relationships.create, rel);
  },

  delete(id: number): Promise<boolean> {
    return fetchMutation(api.relationships.remove, { id });
  },

  deleteByRepoId(repoId: number): Promise<boolean> {
    return fetchMutation(api.relationships.deleteByRepoId, { repo_id: repoId });
  },
};

export const duplicates = {
  getByRepoId(repoId: number): Promise<DuplicateWithNumbers[]> {
    return fetchQuery(api.duplicates.getByRepoId, { repo_id: repoId });
  },

  create(dup: { original_issue_id: number; duplicate_issue_id: number; confidence: number; reason?: string | null }): Promise<DuplicateIssue> {
    return fetchMutation(api.duplicates.create, {
      ...dup,
      reason: dup.reason ?? null,
    });
  },

  deleteByRepoId(repoId: number): Promise<boolean> {
    return fetchMutation(api.duplicates.deleteByRepoId, { repo_id: repoId });
  },
};

export const analysisJobs = {
  create(repoId: number, jobType: string): Promise<AnalysisJob> {
    return fetchMutation(api.analysisJobs.create, {
      repo_id: repoId,
      job_type: jobType,
    });
  },

  async update(id: number, data: Partial<AnalysisJob>): Promise<void> {
    await fetchMutation(api.analysisJobs.update, {
      id,
      patch: stripUndefined(data),
    });
  },

  getByRepoId(repoId: number): Promise<AnalysisJob[]> {
    return fetchQuery(api.analysisJobs.getByRepoId, { repo_id: repoId });
  },
};

export const commentCaches = {
  async getByRepoAndGitHubNumber(repoId: number, githubNumber: number): Promise<CommentCache | undefined> {
    return (await fetchQuery(api.commentCaches.getByRepoAndGitHubNumber, {
      repo_id: repoId,
      github_number: githubNumber,
    })) ?? undefined;
  },

  upsert(commentCache: CommentCache): Promise<CommentCache> {
    return fetchMutation(api.commentCaches.upsert, { commentCache });
  },

  deleteByRepoId(repoId: number): Promise<boolean> {
    return fetchMutation(api.commentCaches.deleteByRepoId, { repo_id: repoId });
  },
};

export const authSessions = {
  create(tokenHash: string, expiresAt: string): Promise<AuthSession> {
    return fetchMutation(api.authSessions.create, {
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
  },

  async getByTokenHash(tokenHash: string): Promise<AuthSession | undefined> {
    return (await fetchQuery(api.authSessions.getByTokenHash, {
      token_hash: tokenHash,
    })) ?? undefined;
  },

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await fetchMutation(api.authSessions.deleteByTokenHash, {
      token_hash: tokenHash,
    });
  },

  async clearExpired(now: string): Promise<void> {
    await fetchMutation(api.authSessions.clearExpired, { now });
  },
};

export const activityEvents = {
  getByRepoId(repoId: number, limit = 60): Promise<ActivityEvent[]> {
    return fetchQuery(api.activityEvents.getByRepoId, { repo_id: repoId, limit });
  },

  create(event: Omit<ActivityEvent, 'id' | 'created_at'>): Promise<ActivityEvent> {
    return fetchMutation(api.activityEvents.create, event);
  },

  async createMany(
    repoId: number,
    events: Array<{
      source?: string;
      entity_type: string;
      entity_number: number | null;
      action: string;
      title: string | null;
      details: string | null;
    }>,
  ): Promise<void> {
    await fetchMutation(api.activityEvents.createMany, {
      repo_id: repoId,
      events,
    });
  },
};
