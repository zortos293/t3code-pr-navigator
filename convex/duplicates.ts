import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  getDuplicateByPair,
  getIssueByNumericId,
  nextNumericId,
  nullableString,
  upsertDuplicateRecord,
} from './model';

function normalizePair(firstId: number, secondId: number) {
  return {
    originalIssueId: Math.min(firstId, secondId),
    duplicateIssueId: Math.max(firstId, secondId),
  };
}

export const getByRepoId = query({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const [duplicates, issues] = await Promise.all([
      ctx.db.query('duplicate_issues').withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id)).collect(),
      ctx.db.query('issues').withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id)).collect(),
    ]);

    const issueNumbers = new Map(issues.map((issue) => [issue.id, issue.github_number] as const));

    return [...duplicates]
      .sort((a, b) => b.confidence - a.confidence)
      .map(({ _id: _ignoredId, _creationTime: _ignoredCreationTime, ...duplicate }) => ({
        ...duplicate,
        original_number: issueNumbers.get(duplicate.original_issue_id) ?? 0,
        duplicate_number: issueNumbers.get(duplicate.duplicate_issue_id) ?? 0,
      }))
      .filter((duplicate) => duplicate.original_number > 0 && duplicate.duplicate_number > 0);
  },
});

export const create = mutation({
  args: {
    original_issue_id: v.number(),
    duplicate_issue_id: v.number(),
    confidence: v.number(),
    reason: v.optional(nullableString),
  },
  handler: async (ctx, args) => {
    const pair = normalizePair(args.original_issue_id, args.duplicate_issue_id);
    const [issue, duplicateIssue] = await Promise.all([
      getIssueByNumericId(ctx, pair.originalIssueId),
      getIssueByNumericId(ctx, pair.duplicateIssueId),
    ]);

    if (!issue || !duplicateIssue) {
      throw new Error('Issue pair not found');
    }

    if (issue.repo_id !== duplicateIssue.repo_id) {
      throw new Error('Duplicate issues must belong to the same repository');
    }

    const existing = await getDuplicateByPair(ctx, pair.originalIssueId, pair.duplicateIssueId);
    const duplicate = {
      id: existing?.id ?? (await nextNumericId(ctx, 'duplicate_issues')),
      repo_id: issue.repo_id,
      original_issue_id: pair.originalIssueId,
      duplicate_issue_id: pair.duplicateIssueId,
      confidence: args.confidence,
      reason: args.reason ?? null,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };

    await upsertDuplicateRecord(ctx, duplicate);
    return duplicate;
  },
});

export const deleteByRepoId = mutation({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const duplicates = await ctx.db
      .query('duplicate_issues')
      .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
      .collect();
    for (const duplicate of duplicates) {
      await ctx.db.delete(duplicate._id);
    }
    return true;
  },
});
