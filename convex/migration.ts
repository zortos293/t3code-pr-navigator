import { mutation } from './_generated/server';
import { v } from 'convex/values';
import {
  analysisJobFields,
  duplicateFields,
  issueFields,
  pullRequestFields,
  relationshipFields,
  repositoryFields,
  upsertAnalysisJobRecord,
  upsertDuplicateRecord,
  upsertIssueRecord,
  upsertPullRequestRecord,
  upsertRelationshipRecord,
  upsertRepositoryRecord,
} from './model';

const repositoryImportValidator = v.object(repositoryFields);
const issueImportValidator = v.object(issueFields);
const pullRequestImportValidator = v.object(pullRequestFields);
const relationshipImportValidator = v.object(relationshipFields);
const duplicateImportValidator = v.object(duplicateFields);
const analysisJobImportValidator = v.object(analysisJobFields);

export const importRepositories = mutation({
  args: { items: v.array(repositoryImportValidator) },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await upsertRepositoryRecord(ctx, item);
    }
    return { imported: args.items.length };
  },
});

export const importIssues = mutation({
  args: { items: v.array(issueImportValidator) },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await upsertIssueRecord(ctx, item);
    }
    return { imported: args.items.length };
  },
});

export const importPullRequests = mutation({
  args: { items: v.array(pullRequestImportValidator) },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await upsertPullRequestRecord(ctx, item);
    }
    return { imported: args.items.length };
  },
});

export const importRelationships = mutation({
  args: { items: v.array(relationshipImportValidator) },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await upsertRelationshipRecord(ctx, item);
    }
    return { imported: args.items.length };
  },
});

export const importDuplicates = mutation({
  args: { items: v.array(duplicateImportValidator) },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await upsertDuplicateRecord(ctx, item);
    }
    return { imported: args.items.length };
  },
});

export const importAnalysisJobs = mutation({
  args: { items: v.array(analysisJobImportValidator) },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await upsertAnalysisJobRecord(ctx, item);
    }
    return { imported: args.items.length };
  },
});
