import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthSessionByTokenHash, upsertAuthSessionRecord } from './model';

export const create = mutation({
  args: {
    token_hash: v.string(),
    expires_at: v.string(),
  },
  handler: async (ctx, args) => {
    const authSession = {
      token_hash: args.token_hash,
      expires_at: args.expires_at,
      created_at: new Date().toISOString(),
    };

    await upsertAuthSessionRecord(ctx, authSession);
    return authSession;
  },
});

export const getByTokenHash = query({
  args: {
    token_hash: v.string(),
  },
  handler: async (ctx, args) => {
    const authSession = await getAuthSessionByTokenHash(ctx, args.token_hash);
    if (!authSession) {
      return null;
    }

    const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...result } = authSession;
    return result;
  },
});

export const deleteByTokenHash = mutation({
  args: {
    token_hash: v.string(),
  },
  handler: async (ctx, args) => {
    const authSession = await getAuthSessionByTokenHash(ctx, args.token_hash);
    if (!authSession) {
      return false;
    }

    await ctx.db.delete(authSession._id);
    return true;
  },
});

export const clearExpired = mutation({
  args: {
    now: v.string(),
  },
  handler: async (ctx, args) => {
    const authSessions = await ctx.db
      .query('auth_sessions')
      .withIndex('by_expires_at', (query) => query.lte('expires_at', args.now))
      .collect();

    for (const authSession of authSessions) {
      await ctx.db.delete(authSession._id);
    }

    return authSessions.length;
  },
});
