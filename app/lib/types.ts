import type { Issue, PullRequest } from './db';

export type Relationship = {
  id: number;
  issue_id: number;
  pr_id: number;
  relationship_type: string;
  confidence: number;
  issue_number: number;
  pr_number: number;
};

export type Comment = {
  id: number;
  body: string;
  author: string;
  author_avatar: string | null;
  created_at: string;
  updated_at: string;
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

export type PRFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
};

export type DetailItem =
  | { type: 'issue'; item: Issue }
  | { type: 'pr'; item: PullRequest };

export type Cluster = {
  issues: Issue[];
  prs: PullRequest[];
};
