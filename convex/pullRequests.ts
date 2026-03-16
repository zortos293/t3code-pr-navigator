import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  getPullRequestByNumericId,
  getPullRequestByRepoAndGitHubNumber,
  nextNumericId,
  pullRequestFields,
  upsertPullRequestRecord,
} from './model';

const pullRequestInputValidator = v.object({
  repo_id: pullRequestFields.repo_id,
  github_number: pullRequestFields.github_number,
  title: pullRequestFields.title,
  body: pullRequestFields.body,
  state: pullRequestFields.state,
  author: pullRequestFields.author,
  author_avatar: pullRequestFields.author_avatar,
  labels: pullRequestFields.labels,
  additions: pullRequestFields.additions,
  deletions: pullRequestFields.deletions,
  changed_files: pullRequestFields.changed_files,
  draft: pullRequestFields.draft,
  created_at: pullRequestFields.created_at,
  updated_at: pullRequestFields.updated_at,
  merged_at: pullRequestFields.merged_at,
  closed_at: pullRequestFields.closed_at,
});

export const getByRepoId = query({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const pullRequests = await ctx.db
      .query('pull_requests')
      .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
      .collect();
    return pullRequests
      .map(({ _id: _ignoredId, _creationTime: _ignoredCreationTime, ...pullRequest }) => pullRequest)
      .sort((a, b) => b.github_number - a.github_number);
  },
});

export const getById = query({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    const pullRequest = await getPullRequestByNumericId(ctx, args.id);
    if (!pullRequest) return null;

    const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...result } = pullRequest;
    return result;
  },
});

export const upsert = mutation({
  args: { pullRequest: pullRequestInputValidator },
  handler: async (ctx, args) => {
    const existing = await getPullRequestByRepoAndGitHubNumber(
      ctx,
      args.pullRequest.repo_id,
      args.pullRequest.github_number
    );

    const pullRequest = {
      id: existing?.id ?? (await nextNumericId(ctx, 'pull_requests')),
      ...args.pullRequest,
    };

    await upsertPullRequestRecord(ctx, pullRequest);
    return pullRequest;
  },
});

export const deleteByRepoId = mutation({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const pullRequests = await ctx.db
      .query('pull_requests')
      .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
      .collect();
    for (const pullRequest of pullRequests) {
      await ctx.db.delete(pullRequest._id);
    }
    return true;
  },
});
