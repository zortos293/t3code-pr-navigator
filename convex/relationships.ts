import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  getIssueByNumericId,
  getPullRequestByNumericId,
  getRelationshipByIssueAndPr,
  getRelationshipByNumericId,
  nextNumericId,
  upsertRelationshipRecord,
} from './model';

function sortRelationships<T extends { confidence: number }>(relationships: T[]) {
  return [...relationships].sort((a, b) => b.confidence - a.confidence);
}

export const getByRepoId = query({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const [relationships, issues, pullRequests] = await Promise.all([
      ctx.db
        .query('issue_pr_relationships')
        .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
        .collect(),
      ctx.db.query('issues').withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id)).collect(),
      ctx.db
        .query('pull_requests')
        .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
        .collect(),
    ]);

    const issueNumbers = new Map(issues.map((issue) => [issue.id, issue.github_number] as const));
    const prNumbers = new Map(pullRequests.map((pullRequest) => [pullRequest.id, pullRequest.github_number] as const));

    return sortRelationships(relationships)
      .map(({ _id: _ignoredId, _creationTime: _ignoredCreationTime, ...relationship }) => ({
        ...relationship,
        issue_number: issueNumbers.get(relationship.issue_id) ?? 0,
        pr_number: prNumbers.get(relationship.pr_id) ?? 0,
      }))
      .filter((relationship) => relationship.issue_number > 0 && relationship.pr_number > 0);
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const [relationships, issues, pullRequests] = await Promise.all([
      ctx.db.query('issue_pr_relationships').collect(),
      ctx.db.query('issues').collect(),
      ctx.db.query('pull_requests').collect(),
    ]);

    const issueNumbers = new Map(issues.map((issue) => [issue.id, issue.github_number] as const));
    const prNumbers = new Map(pullRequests.map((pullRequest) => [pullRequest.id, pullRequest.github_number] as const));

    return sortRelationships(relationships)
      .map(({ _id: _ignoredId, _creationTime: _ignoredCreationTime, ...relationship }) => ({
        ...relationship,
        issue_number: issueNumbers.get(relationship.issue_id) ?? 0,
        pr_number: prNumbers.get(relationship.pr_id) ?? 0,
      }))
      .filter((relationship) => relationship.issue_number > 0 && relationship.pr_number > 0);
  },
});

export const create = mutation({
  args: {
    issue_id: v.number(),
    pr_id: v.number(),
    relationship_type: v.optional(v.string()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const [issue, pullRequest] = await Promise.all([
      getIssueByNumericId(ctx, args.issue_id),
      getPullRequestByNumericId(ctx, args.pr_id),
    ]);

    if (!issue || !pullRequest) {
      throw new Error('Issue or pull request not found');
    }

    if (issue.repo_id !== pullRequest.repo_id) {
      throw new Error('Issue and pull request must belong to the same repository');
    }

    const existing = await getRelationshipByIssueAndPr(ctx, issue.id, pullRequest.id);
    const relationship = {
      id: existing?.id ?? (await nextNumericId(ctx, 'issue_pr_relationships')),
      repo_id: issue.repo_id,
      issue_id: issue.id,
      pr_id: pullRequest.id,
      relationship_type: args.relationship_type ?? 'solves',
      confidence: args.confidence ?? 1,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };

    await upsertRelationshipRecord(ctx, relationship);
    return relationship;
  },
});

export const remove = mutation({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    const relationship = await getRelationshipByNumericId(ctx, args.id);
    if (!relationship) {
      return false;
    }

    await ctx.db.delete(relationship._id);
    return true;
  },
});

export const deleteByRepoId = mutation({
  args: { repo_id: v.number() },
  handler: async (ctx, args) => {
    const relationships = await ctx.db
      .query('issue_pr_relationships')
      .withIndex('by_repo', (query) => query.eq('repo_id', args.repo_id))
      .collect();
    for (const relationship of relationships) {
      await ctx.db.delete(relationship._id);
    }
    return true;
  },
});
