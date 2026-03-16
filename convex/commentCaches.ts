import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  commentCacheFields,
  getCommentCacheByRepoAndGitHubNumber,
  upsertCommentCacheRecord,
} from './model';

const commentCacheInputValidator = v.object({
  repo_id: commentCacheFields.repo_id,
  github_number: commentCacheFields.github_number,
  comments: commentCacheFields.comments,
  fetched_at: commentCacheFields.fetched_at,
});

export const getByRepoAndGitHubNumber = query({
  args: {
    repo_id: v.number(),
    github_number: v.number(),
  },
  handler: async (ctx, args) => {
    const commentCache = await getCommentCacheByRepoAndGitHubNumber(
      ctx,
      args.repo_id,
      args.github_number
    );
    if (!commentCache) {
      return null;
    }

    return {
      repo_id: commentCache.repo_id,
      github_number: commentCache.github_number,
      comments: commentCache.comments,
      fetched_at: commentCache.fetched_at,
    };
  },
});

export const upsert = mutation({
  args: { commentCache: commentCacheInputValidator },
  handler: async (ctx, args) => {
    await upsertCommentCacheRecord(ctx, args.commentCache);
    return args.commentCache;
  },
});

export const deleteByRepoId = mutation({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const commentCaches = await ctx.db
      .query('comment_caches')
      .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
      .collect();

    for (const commentCache of commentCaches) {
      await ctx.db.delete(commentCache._id);
    }

    return true;
  },
});
