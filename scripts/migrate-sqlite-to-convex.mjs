import Database from 'better-sqlite3';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
import { loadLocalEnv } from '../app/lib/serverEnv.ts';

loadLocalEnv();

const DEFAULT_DB_PATH = process.env.DATABASE_URL || './data/pr-navigator.db';
const BATCH_SIZE = 100;

function chunkItems(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function getConvexUrl() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL must be set before running the Convex migration.');
  }
  return url;
}

async function importBatches(label, items, importer) {
  if (items.length === 0) {
    console.log(`Skipping ${label}: no rows found.`);
    return;
  }

  const batches = chunkItems(items, BATCH_SIZE);
  for (const [index, batch] of batches.entries()) {
    await importer(batch);
    console.log(`Imported ${label} batch ${index + 1}/${batches.length} (${batch.length} rows).`);
  }
}

async function main() {
  const sqlitePath = path.resolve(process.cwd(), process.argv[2] || DEFAULT_DB_PATH);
  const db = new Database(sqlitePath, { readonly: true });
  const convex = new ConvexHttpClient(getConvexUrl());

  const repositories = db.prepare('SELECT * FROM repositories ORDER BY id ASC').all();
  const issues = db.prepare('SELECT * FROM issues ORDER BY id ASC').all();
  const pullRequests = db.prepare('SELECT * FROM pull_requests ORDER BY id ASC').all();
  const relationships = db.prepare('SELECT * FROM issue_pr_relationships ORDER BY id ASC').all();
  const duplicates = db.prepare('SELECT * FROM duplicate_issues ORDER BY id ASC').all();
  const analysisJobs = db.prepare('SELECT * FROM analysis_jobs ORDER BY id ASC').all();

  const issueRepoMap = new Map(issues.map((issue) => [issue.id, issue.repo_id]));
  const prRepoMap = new Map(pullRequests.map((pullRequest) => [pullRequest.id, pullRequest.repo_id]));

  await importBatches('repositories', repositories, (batch) =>
    convex.mutation(api.migration.importRepositories, { items: batch })
  );
  await importBatches('issues', issues, (batch) =>
    convex.mutation(api.migration.importIssues, { items: batch })
  );
  await importBatches('pull requests', pullRequests, (batch) =>
    convex.mutation(api.migration.importPullRequests, { items: batch })
  );
  await importBatches(
    'relationships',
    relationships.map((relationship) => ({
      ...relationship,
      repo_id: issueRepoMap.get(relationship.issue_id) ?? prRepoMap.get(relationship.pr_id) ?? 0,
    })),
    (batch) => convex.mutation(api.migration.importRelationships, { items: batch })
  );
  await importBatches(
    'duplicates',
    duplicates.map((duplicate) => ({
      ...duplicate,
      repo_id: issueRepoMap.get(duplicate.original_issue_id) ?? issueRepoMap.get(duplicate.duplicate_issue_id) ?? 0,
      reason: duplicate.reason ?? null,
    })),
    (batch) => convex.mutation(api.migration.importDuplicates, { items: batch })
  );
  await importBatches(
    'analysis jobs',
    analysisJobs.map((job) => ({
      ...job,
      result: job.result ?? null,
      error: job.error ?? null,
      started_at: job.started_at ?? null,
      completed_at: job.completed_at ?? null,
    })),
    (batch) => convex.mutation(api.migration.importAnalysisJobs, { items: batch })
  );

  console.log('SQLite to Convex migration finished.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
