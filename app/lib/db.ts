import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { loadLocalEnv } from './serverEnv';

loadLocalEnv();

const DB_PATH = process.env.DATABASE_URL || './data/pr-navigator.db';

function getDbPath(): string {
  const dbPath = path.resolve(process.cwd(), DB_PATH);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dbPath;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(getDbPath());
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initializeSchema(_db);
  }
  return _db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL UNIQUE,
      description TEXT,
      stars INTEGER DEFAULT 0,
      open_issues_count INTEGER DEFAULT 0,
      open_prs_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      github_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      state TEXT NOT NULL,
      author TEXT NOT NULL,
      author_avatar TEXT,
      labels TEXT,
      created_at DATETIME,
      updated_at DATETIME,
      closed_at DATETIME,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
      UNIQUE(repo_id, github_number)
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      github_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      state TEXT NOT NULL,
      author TEXT NOT NULL,
      author_avatar TEXT,
      labels TEXT,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      changed_files INTEGER DEFAULT 0,
      draft INTEGER DEFAULT 0,
      created_at DATETIME,
      updated_at DATETIME,
      merged_at DATETIME,
      closed_at DATETIME,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
      UNIQUE(repo_id, github_number)
    );

    CREATE TABLE IF NOT EXISTS issue_pr_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      pr_id INTEGER NOT NULL,
      relationship_type TEXT DEFAULT 'solves',
      confidence REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
      FOREIGN KEY (pr_id) REFERENCES pull_requests(id) ON DELETE CASCADE,
      UNIQUE(issue_id, pr_id)
    );

    CREATE TABLE IF NOT EXISTS duplicate_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_issue_id INTEGER NOT NULL,
      duplicate_issue_id INTEGER NOT NULL,
      confidence REAL DEFAULT 0.0,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
      FOREIGN KEY (duplicate_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
      UNIQUE(original_issue_id, duplicate_issue_id)
    );

    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      result TEXT,
      error TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'sync',
      entity_type TEXT NOT NULL,
      entity_number INTEGER,
      action TEXT NOT NULL,
      title TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
    );
  `);
}

export type Repository = {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  open_issues_count: number;
  open_prs_count: number;
  created_at: string;
  updated_at: string;
};

export type Issue = {
  id: number;
  repo_id: number;
  github_number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  author_avatar: string | null;
  labels: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
};

export type PullRequest = {
  id: number;
  repo_id: number;
  github_number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  author_avatar: string | null;
  labels: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  draft: number;
  created_at: string | null;
  updated_at: string | null;
  merged_at: string | null;
  closed_at: string | null;
};

export type IssueRelationship = {
  id: number;
  issue_id: number;
  pr_id: number;
  relationship_type: string;
  confidence: number;
  created_at: string;
};

export type DuplicateIssue = {
  id: number;
  original_issue_id: number;
  duplicate_issue_id: number;
  confidence: number;
  reason: string | null;
  created_at: string;
};

export type AnalysisJob = {
  id: number;
  repo_id: number;
  job_type: string;
  status: string;
  progress: number;
  result: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type ActivityEvent = {
  id: number;
  repo_id: number;
  source: string;
  entity_type: string;
  entity_number: number | null;
  action: string;
  title: string | null;
  details: string | null;
  created_at: string;
};

export const repos = {
  getAll(): Repository[] {
    return getDb().prepare('SELECT * FROM repositories ORDER BY updated_at DESC').all() as Repository[];
  },

  getById(id: number): Repository | undefined {
    return getDb().prepare('SELECT * FROM repositories WHERE id = ?').get(id) as Repository | undefined;
  },

  getByFullName(fullName: string): Repository | undefined {
    return getDb().prepare('SELECT * FROM repositories WHERE full_name = ?').get(fullName) as Repository | undefined;
  },

  create(repo: Omit<Repository, 'id' | 'created_at' | 'updated_at'>): Repository {
    const stmt = getDb().prepare(`
      INSERT INTO repositories (owner, name, full_name, description, stars, open_issues_count, open_prs_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(repo.owner, repo.name, repo.full_name, repo.description, repo.stars, repo.open_issues_count, repo.open_prs_count);
    return this.getById(result.lastInsertRowid as number)!;
  },

  update(id: number, data: Partial<Repository>): Repository | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    getDb().prepare(`UPDATE repositories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM repositories WHERE id = ?').run(id);
  },
};

export const issues = {
  getByRepoId(repoId: number): Issue[] {
    return getDb().prepare('SELECT * FROM issues WHERE repo_id = ? ORDER BY github_number DESC').all(repoId) as Issue[];
  },

  getOpenByRepoId(repoId: number): Issue[] {
    return getDb().prepare('SELECT * FROM issues WHERE repo_id = ? AND state = ? ORDER BY github_number DESC').all(repoId, 'open') as Issue[];
  },

  getById(id: number): Issue | undefined {
    return getDb().prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue | undefined;
  },

  upsert(issue: Omit<Issue, 'id'>): Issue {
    const stmt = getDb().prepare(`
      INSERT INTO issues (repo_id, github_number, title, body, state, author, author_avatar, labels, created_at, updated_at, closed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo_id, github_number) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        state = excluded.state,
        author = excluded.author,
        author_avatar = excluded.author_avatar,
        labels = excluded.labels,
        updated_at = excluded.updated_at,
        closed_at = excluded.closed_at
    `);
    stmt.run(
      issue.repo_id, issue.github_number, issue.title, issue.body,
      issue.state, issue.author, issue.author_avatar, issue.labels,
      issue.created_at, issue.updated_at, issue.closed_at
    );
    return getDb().prepare('SELECT * FROM issues WHERE repo_id = ? AND github_number = ?').get(issue.repo_id, issue.github_number) as Issue;
  },

  deleteByRepoId(repoId: number): void {
    getDb().prepare('DELETE FROM issues WHERE repo_id = ?').run(repoId);
  },
};

export const pullRequests = {
  getByRepoId(repoId: number): PullRequest[] {
    return getDb().prepare('SELECT * FROM pull_requests WHERE repo_id = ? ORDER BY github_number DESC').all(repoId) as PullRequest[];
  },

  getById(id: number): PullRequest | undefined {
    return getDb().prepare('SELECT * FROM pull_requests WHERE id = ?').get(id) as PullRequest | undefined;
  },

  upsert(pr: Omit<PullRequest, 'id'>): PullRequest {
    const stmt = getDb().prepare(`
      INSERT INTO pull_requests (repo_id, github_number, title, body, state, author, author_avatar, labels, additions, deletions, changed_files, draft, created_at, updated_at, merged_at, closed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo_id, github_number) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        state = excluded.state,
        author = excluded.author,
        author_avatar = excluded.author_avatar,
        labels = excluded.labels,
        additions = excluded.additions,
        deletions = excluded.deletions,
        changed_files = excluded.changed_files,
        draft = excluded.draft,
        updated_at = excluded.updated_at,
        merged_at = excluded.merged_at,
        closed_at = excluded.closed_at
    `);
    stmt.run(
      pr.repo_id, pr.github_number, pr.title, pr.body,
      pr.state, pr.author, pr.author_avatar, pr.labels,
      pr.additions, pr.deletions, pr.changed_files, pr.draft ? 1 : 0,
      pr.created_at, pr.updated_at, pr.merged_at, pr.closed_at
    );
    return getDb().prepare('SELECT * FROM pull_requests WHERE repo_id = ? AND github_number = ?').get(pr.repo_id, pr.github_number) as PullRequest;
  },

  deleteByRepoId(repoId: number): void {
    getDb().prepare('DELETE FROM pull_requests WHERE repo_id = ?').run(repoId);
  },
};

export const relationships = {
  getByRepoId(repoId: number): (IssueRelationship & { issue_number: number; pr_number: number })[] {
    return getDb().prepare(`
      SELECT r.*, i.github_number as issue_number, p.github_number as pr_number
      FROM issue_pr_relationships r
      JOIN issues i ON r.issue_id = i.id
      JOIN pull_requests p ON r.pr_id = p.id
      WHERE i.repo_id = ?
      ORDER BY r.confidence DESC
    `).all(repoId) as (IssueRelationship & { issue_number: number; pr_number: number })[];
  },

  getAll(): (IssueRelationship & { issue_number: number; pr_number: number })[] {
    return getDb().prepare(`
      SELECT r.*, i.github_number as issue_number, p.github_number as pr_number
      FROM issue_pr_relationships r
      JOIN issues i ON r.issue_id = i.id
      JOIN pull_requests p ON r.pr_id = p.id
      ORDER BY r.confidence DESC
    `).all() as (IssueRelationship & { issue_number: number; pr_number: number })[];
  },

  create(rel: { issue_id: number; pr_id: number; relationship_type?: string; confidence?: number }): IssueRelationship {
    const stmt = getDb().prepare(`
      INSERT OR REPLACE INTO issue_pr_relationships (issue_id, pr_id, relationship_type, confidence)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(rel.issue_id, rel.pr_id, rel.relationship_type || 'solves', rel.confidence || 0);
    return getDb().prepare('SELECT * FROM issue_pr_relationships WHERE id = ?').get(result.lastInsertRowid) as IssueRelationship;
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM issue_pr_relationships WHERE id = ?').run(id);
  },

  deleteByRepoId(repoId: number): void {
    getDb().prepare(`
      DELETE FROM issue_pr_relationships WHERE issue_id IN (
        SELECT id FROM issues WHERE repo_id = ?
      )
    `).run(repoId);
  },
};

export const duplicates = {
  getByRepoId(repoId: number): (DuplicateIssue & { original_number: number; duplicate_number: number })[] {
    return getDb().prepare(`
      SELECT d.*, o.github_number as original_number, dup.github_number as duplicate_number
      FROM duplicate_issues d
      JOIN issues o ON d.original_issue_id = o.id
      JOIN issues dup ON d.duplicate_issue_id = dup.id
      WHERE o.repo_id = ?
      ORDER BY d.confidence DESC
    `).all(repoId) as (DuplicateIssue & { original_number: number; duplicate_number: number })[];
  },

  create(dup: { original_issue_id: number; duplicate_issue_id: number; confidence: number; reason?: string }): DuplicateIssue {
    const stmt = getDb().prepare(`
      INSERT OR REPLACE INTO duplicate_issues (original_issue_id, duplicate_issue_id, confidence, reason)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(dup.original_issue_id, dup.duplicate_issue_id, dup.confidence, dup.reason || null);
    return getDb().prepare('SELECT * FROM duplicate_issues WHERE id = ?').get(result.lastInsertRowid) as DuplicateIssue;
  },

  deleteByRepoId(repoId: number): void {
    getDb().prepare(`
      DELETE FROM duplicate_issues WHERE original_issue_id IN (
        SELECT id FROM issues WHERE repo_id = ?
      )
    `).run(repoId);
  },
};

export const analysisJobs = {
  create(repoId: number, jobType: string): AnalysisJob {
    const stmt = getDb().prepare(`
      INSERT INTO analysis_jobs (repo_id, job_type, status, started_at)
      VALUES (?, ?, 'running', CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(repoId, jobType);
    return getDb().prepare('SELECT * FROM analysis_jobs WHERE id = ?').get(result.lastInsertRowid) as AnalysisJob;
  },

  update(id: number, data: Partial<AnalysisJob>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    values.push(id);
    getDb().prepare(`UPDATE analysis_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  getByRepoId(repoId: number): AnalysisJob[] {
    return getDb().prepare('SELECT * FROM analysis_jobs WHERE repo_id = ? ORDER BY id DESC').all(repoId) as AnalysisJob[];
  },
};

export const activityEvents = {
  getByRepoId(repoId: number, limit = 60): ActivityEvent[] {
    return getDb().prepare(`
      SELECT *
      FROM activity_events
      WHERE repo_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(repoId, limit) as ActivityEvent[];
  },

  create(event: Omit<ActivityEvent, 'id' | 'created_at'>): ActivityEvent {
    const stmt = getDb().prepare(`
      INSERT INTO activity_events (repo_id, source, entity_type, entity_number, action, title, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      event.repo_id,
      event.source,
      event.entity_type,
      event.entity_number,
      event.action,
      event.title,
      event.details,
    );
    return getDb().prepare('SELECT * FROM activity_events WHERE id = ?').get(result.lastInsertRowid) as ActivityEvent;
  },

  createMany(
    repoId: number,
    events: Array<{
      source?: string;
      entity_type: string;
      entity_number: number | null;
      action: string;
      title: string | null;
      details: string | null;
    }>,
  ): void {
    if (events.length === 0) {
      return;
    }

    const stmt = getDb().prepare(`
      INSERT INTO activity_events (repo_id, source, entity_type, entity_number, action, title, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = getDb().transaction(() => {
      for (const event of events) {
        stmt.run(
          repoId,
          event.source || 'sync',
          event.entity_type,
          event.entity_number,
          event.action,
          event.title,
          event.details,
        );
      }
    });

    insertMany();
  },
};
