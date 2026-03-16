import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  getAnalysisJobByNumericId,
  nextNumericId,
  nullableString,
  upsertAnalysisJobRecord,
} from './model';

const analysisJobPatchValidator = v.object({
  repo_id: v.optional(v.number()),
  job_type: v.optional(v.string()),
  status: v.optional(v.string()),
  progress: v.optional(v.number()),
  result: v.optional(nullableString),
  error: v.optional(nullableString),
  started_at: v.optional(nullableString),
  completed_at: v.optional(nullableString),
});

export const create = mutation({
  args: {
    repo_id: v.number(),
    job_type: v.string(),
  },
  handler: async (ctx, args) => {
    const job = {
      id: await nextNumericId(ctx, 'analysis_jobs'),
      repo_id: args.repo_id,
      job_type: args.job_type,
      status: 'running',
      progress: 0,
      result: null,
      error: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    };

    await upsertAnalysisJobRecord(ctx, job);
    return job;
  },
});

export const update = mutation({
  args: {
    id: v.number(),
    patch: analysisJobPatchValidator,
  },
  handler: async (ctx, args) => {
    const job = await getAnalysisJobByNumericId(ctx, args.id);
    if (!job) {
      throw new Error('Analysis job not found');
    }

    await ctx.db.patch(job._id, args.patch);
    const updated = await getAnalysisJobByNumericId(ctx, args.id);
    if (!updated) {
      throw new Error('Analysis job not found after update');
    }

    const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...result } = updated;
    return result;
  },
});

export const getByRepoId = query({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query('analysis_jobs')
      .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
      .collect();
    return jobs
      .map(({ _id: _ignoredId, _creationTime: _ignoredCreationTime, ...job }) => job)
      .sort((a, b) => b.id - a.id);
  },
});
