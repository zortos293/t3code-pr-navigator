import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  getRepositoryByFullName,
  getRepositoryByNumericId,
  nextNumericId,
  nullableString,
  upsertRepositoryRecord,
} from './model';

const repositoryPatchValidator = v.object({
  owner: v.optional(v.string()),
  name: v.optional(v.string()),
  full_name: v.optional(v.string()),
  description: v.optional(nullableString),
  stars: v.optional(v.number()),
  open_issues_count: v.optional(v.number()),
  open_prs_count: v.optional(v.number()),
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const repositories = await ctx.db.query('repositories').collect();
    return repositories
      .map(({ _id: _ignoredId, _creationTime: _ignoredCreationTime, ...repository }) => repository)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
});

export const getById = query({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    const repository = await getRepositoryByNumericId(ctx, args.id);
    if (!repository) return null;

    const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...result } = repository;
    return result;
  },
});

export const getByFullName = query({
  args: { full_name: v.string() },
  handler: async (ctx, args) => {
    const repository = await getRepositoryByFullName(ctx, args.full_name);
    if (!repository) return null;

    const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...result } = repository;
    return result;
  },
});

export const create = mutation({
  args: {
    owner: v.string(),
    name: v.string(),
    full_name: v.string(),
    description: nullableString,
    stars: v.number(),
    open_issues_count: v.number(),
    open_prs_count: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await getRepositoryByFullName(ctx, args.full_name);
    if (existing) {
      throw new Error('Repository already exists');
    }

    const now = new Date().toISOString();
    const repository = {
      id: await nextNumericId(ctx, 'repositories'),
      ...args,
      created_at: now,
      updated_at: now,
    };

    await upsertRepositoryRecord(ctx, repository);
    return repository;
  },
});

export const update = mutation({
  args: {
    id: v.number(),
    patch: repositoryPatchValidator,
  },
  handler: async (ctx, args) => {
    const repository = await getRepositoryByNumericId(ctx, args.id);
    if (!repository) {
      throw new Error('Repository not found');
    }

    await ctx.db.patch(repository._id, {
      ...args.patch,
      updated_at: new Date().toISOString(),
    });

    const updated = await getRepositoryByNumericId(ctx, args.id);
    if (!updated) {
      throw new Error('Repository not found after update');
    }

    const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...result } = updated;
    return result;
  },
});

export const remove = mutation({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    const repository = await getRepositoryByNumericId(ctx, args.id);
    if (!repository) {
      return false;
    }

    const [issues, pullRequests, relationships, duplicates, jobs, commentCaches, activityEvents] = await Promise.all([
      ctx.db.query('issues').withIndex('by_repo', (query) => query.eq('repo_id', args.id)).collect(),
      ctx.db.query('pull_requests').withIndex('by_repo', (query) => query.eq('repo_id', args.id)).collect(),
      ctx.db
        .query('issue_pr_relationships')
        .withIndex('by_repo', (query) => query.eq('repo_id', args.id))
        .collect(),
      ctx.db.query('duplicate_issues').withIndex('by_repo', (query) => query.eq('repo_id', args.id)).collect(),
      ctx.db.query('analysis_jobs').withIndex('by_repo', (query) => query.eq('repo_id', args.id)).collect(),
      ctx.db.query('comment_caches').withIndex('by_repo', (query) => query.eq('repo_id', args.id)).collect(),
      ctx.db.query('activity_events').withIndex('by_repo', (query) => query.eq('repo_id', args.id)).collect(),
    ]);

    for (const issue of issues) {
      await ctx.db.delete(issue._id);
    }
    for (const pullRequest of pullRequests) {
      await ctx.db.delete(pullRequest._id);
    }
    for (const relationship of relationships) {
      await ctx.db.delete(relationship._id);
    }
    for (const duplicate of duplicates) {
      await ctx.db.delete(duplicate._id);
    }
    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }
    for (const commentCache of commentCaches) {
      await ctx.db.delete(commentCache._id);
    }
    for (const activityEvent of activityEvents) {
      await ctx.db.delete(activityEvent._id);
    }

    await ctx.db.delete(repository._id);
    return true;
  },
});
