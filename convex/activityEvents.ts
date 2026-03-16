import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  activityEventFields,
  nextNumericId,
  nullableString,
  upsertActivityEventRecord,
} from './model';

const activityEventInputValidator = v.object({
  repo_id: activityEventFields.repo_id,
  source: activityEventFields.source,
  entity_type: activityEventFields.entity_type,
  entity_number: v.union(v.number(), v.null()),
  action: activityEventFields.action,
  title: nullableString,
  details: nullableString,
});

export const getByRepoId = query({
  args: {
    repo_id: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 60;
    const activityEvents = await ctx.db
      .query('activity_events')
      .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
      .collect();

    return activityEvents
      .map(({ _id: _ignoredId, _creationTime: _ignoredCreationTime, ...activityEvent }) => activityEvent)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  },
});

export const create = mutation({
  args: activityEventInputValidator,
  handler: async (ctx, args) => {
    const activityEvent = {
      id: await nextNumericId(ctx, 'activity_events'),
      ...args,
      created_at: new Date().toISOString(),
    };

    await upsertActivityEventRecord(ctx, activityEvent);
    return activityEvent;
  },
});

export const createMany = mutation({
  args: {
    repo_id: v.number(),
    events: v.array(v.object({
      source: v.optional(v.string()),
      entity_type: v.string(),
      entity_number: v.union(v.number(), v.null()),
      action: v.string(),
      title: nullableString,
      details: nullableString,
    })),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    for (const event of args.events) {
      await upsertActivityEventRecord(ctx, {
        id: await nextNumericId(ctx, 'activity_events'),
        repo_id: args.repo_id,
        source: event.source ?? 'sync',
        entity_type: event.entity_type,
        entity_number: event.entity_number,
        action: event.action,
        title: event.title,
        details: event.details,
        created_at: now,
      });
    }

    return true;
  },
});
