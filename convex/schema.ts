import { defineSchema, defineTable } from 'convex/server';
import {
  analysisJobFields,
  commentCacheFields,
  duplicateFields,
  issueFields,
  pullRequestFields,
  relationshipFields,
  repositoryFields,
} from './model';

export default defineSchema({
  counters: defineTable({
    name: repositoryFields.name,
    value: repositoryFields.id,
  }).index('by_name', ['name']),

  repositories: defineTable(repositoryFields)
    .index('by_numeric_id', ['id'])
    .index('by_full_name', ['full_name']),

  issues: defineTable(issueFields)
    .index('by_numeric_id', ['id'])
    .index('by_repo', ['repo_id'])
    .index('by_repo_and_github_number', ['repo_id', 'github_number']),

  pull_requests: defineTable(pullRequestFields)
    .index('by_numeric_id', ['id'])
    .index('by_repo', ['repo_id'])
    .index('by_repo_and_github_number', ['repo_id', 'github_number']),

  issue_pr_relationships: defineTable(relationshipFields)
    .index('by_numeric_id', ['id'])
    .index('by_repo', ['repo_id'])
    .index('by_issue_and_pr', ['issue_id', 'pr_id']),

  duplicate_issues: defineTable(duplicateFields)
    .index('by_numeric_id', ['id'])
    .index('by_repo', ['repo_id'])
    .index('by_original_and_duplicate', ['original_issue_id', 'duplicate_issue_id']),

  analysis_jobs: defineTable(analysisJobFields)
    .index('by_numeric_id', ['id'])
    .index('by_repo', ['repo_id'])
    .index('by_repo_and_job_type', ['repo_id', 'job_type']),

  comment_caches: defineTable(commentCacheFields)
    .index('by_repo', ['repo_id'])
    .index('by_repo_and_github_number', ['repo_id', 'github_number']),
});
