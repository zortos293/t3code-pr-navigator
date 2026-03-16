import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  getIssueByNumericId,
  getIssueByRepoAndGitHubNumber,
  issueFields,
  nextNumericId,
  upsertIssueRecord,
} from './model';

const issueInputValidator = v.object({
  repo_id: issueFields.repo_id,
  github_number: issueFields.github_number,
  title: issueFields.title,
  body: issueFields.body,
  state: issueFields.state,
  author: issueFields.author,
  author_avatar: issueFields.author_avatar,
  labels: issueFields.labels,
  created_at: issueFields.created_at,
  updated_at: issueFields.updated_at,
  closed_at: issueFields.closed_at,
});

export const getByRepoId = query({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const issues = await ctx.db.query('issues').withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id)).collect();
    return issues
      .map(({ _id: _ignoredId, _creationTime: _ignoredCreationTime, ...issue }) => issue)
      .sort((a, b) => b.github_number - a.github_number);
  },
});

export const getById = query({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    const issue = await getIssueByNumericId(ctx, args.id);
    if (!issue) return null;

    const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...result } = issue;
    return result;
  },
});

export const upsert = mutation({
  args: { issue: issueInputValidator },
  handler: async (ctx, args) => {
    const existing = await getIssueByRepoAndGitHubNumber(
      ctx,
      args.issue.repo_id,
      args.issue.github_number
    );

    const issue = {
      id: existing?.id ?? (await nextNumericId(ctx, 'issues')),
      ...args.issue,
    };

    await upsertIssueRecord(ctx, issue);
    return issue;
  },
});

export const deleteByRepoId = mutation({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const issues = await ctx.db.query('issues').withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id)).collect();
    for (const issue of issues) {
      await ctx.db.delete(issue._id);
    }
    return true;
  },
});
