import { Octokit } from '@octokit/rest';

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  return new Octokit(token ? { auth: token } : {});
}

export type GitHubRepo = {
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  open_issues_count: number;
};

export type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: { login: string; avatar_url: string } | null;
  labels: { name: string }[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: unknown;
};

export type GitHubPR = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: { login: string; avatar_url: string } | null;
  labels: { name: string }[];
  additions: number;
  deletions: number;
  changed_files: number;
  draft: boolean;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
};

type SyncProgressCallback = (
  type: 'issue' | 'pr',
  current: number,
  total: number,
  item: GitHubIssue | GitHubPR,
) => void | Promise<void>;

export function parseGitHubUrl(url: string): { owner: string; name: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/\s?#]+)/,
    /^([^/\s]+)\/([^/\s]+)$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], name: match[2].replace(/\.git$/, '') };
    }
  }
  return null;
}

export async function fetchRepository(owner: string, name: string): Promise<GitHubRepo> {
  const octokit = getOctokit();
  const { data } = await octokit.repos.get({ owner, repo: name });
  return {
    owner: data.owner.login,
    name: data.name,
    full_name: data.full_name,
    description: data.description,
    stargazers_count: data.stargazers_count,
    open_issues_count: data.open_issues_count,
  };
}

export async function fetchIssues(owner: string, name: string): Promise<GitHubIssue[]> {
  const octokit = getOctokit();
  const allIssues: GitHubIssue[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.issues.listForRepo({
      owner,
      repo: name,
      state: 'open',
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    for (const item of data) {
      if (!item.pull_request) {
        allIssues.push({
          number: item.number,
          title: item.title,
          body: item.body ?? null,
          state: item.state,
          user: item.user ? { login: item.user.login, avatar_url: item.user.avatar_url } : null,
          labels: (item.labels || []).map((l) => typeof l === 'string' ? { name: l } : { name: l.name || '' }),
          created_at: item.created_at,
          updated_at: item.updated_at,
          closed_at: item.closed_at ?? null,
        });
      }
    }

    if (data.length < 100) break;
    page++;
  }

  return allIssues;
}

export async function fetchPullRequests(owner: string, name: string): Promise<GitHubPR[]> {
  const octokit = getOctokit();
  const allPRs: GitHubPR[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner,
      repo: name,
      state: 'open',
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    for (const pr of data) {
      allPRs.push({
        number: pr.number,
        title: pr.title,
        body: pr.body ?? null,
        state: pr.state,
        user: pr.user ? { login: pr.user.login, avatar_url: pr.user.avatar_url } : null,
        labels: (pr.labels || []).map((l) => ({ name: l.name || '' })),
        additions: 0,
        deletions: 0,
        changed_files: 0,
        draft: pr.draft || false,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at ?? null,
        closed_at: pr.closed_at ?? null,
      });
    }

    if (data.length < 100) break;
    page++;
  }

  return allPRs;
}

export async function fetchPRDetails(owner: string, name: string, prNumber: number): Promise<{ additions: number; deletions: number; changed_files: number }> {
  const octokit = getOctokit();
  const { data } = await octokit.pulls.get({ owner, repo: name, pull_number: prNumber });
  return {
    additions: data.additions,
    deletions: data.deletions,
    changed_files: data.changed_files,
  };
}

const SOLVES_KEYWORDS = new Set(['fixes', 'fix', 'closes', 'close', 'resolves', 'resolve']);

export function extractIssueReferences(text: string): { issueNumber: number; type: 'solves' | 'relates' }[] {
  const pattern = /(fixes|fix|closes|close|resolves|resolve|relates\s+to|related\s+to|addresses|refs|references)\s+(?:#|https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/)(\d+)/gi;
  const results: { issueNumber: number; type: 'solves' | 'relates' }[] = [];
  const seen = new Set<number>();

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const issueNumber = parseInt(match[2], 10);
    if (seen.has(issueNumber)) continue;
    seen.add(issueNumber);
    const keyword = match[1].replace(/\s+/g, ' ').toLowerCase();
    const type = SOLVES_KEYWORDS.has(keyword) ? 'solves' : 'relates';
    results.push({ issueNumber, type });
  }

  return results;
}

export async function syncRepository(
  repoId: number,
  owner: string,
  name: string,
  onProgress?: SyncProgressCallback,
) {
  const { repos, issues: issuesDb, pullRequests: prsDb, relationships: relationshipsDb } = await import('./db');

  const repoData = await fetchRepository(owner, name);
  const [ghIssues, ghPRs] = await Promise.all([
    fetchIssues(owner, name),
    fetchPullRequests(owner, name),
  ]);

  repos.update(repoId, {
    description: repoData.description,
    stars: repoData.stargazers_count,
    open_issues_count: ghIssues.length,
    open_prs_count: ghPRs.length,
  });

  const issueMap = new Map<number, number>();
  for (const [index, issue] of ghIssues.entries()) {
    const dbIssue = issuesDb.upsert({
      repo_id: repoId,
      github_number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      author: issue.user?.login || 'unknown',
      author_avatar: issue.user?.avatar_url || null,
      labels: JSON.stringify(issue.labels.map((l) => l.name)),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
    });
    issueMap.set(issue.number, dbIssue.id);
    await onProgress?.('issue', index + 1, ghIssues.length, issue);
  }

  const prMap = new Map<number, number>();
  for (const [index, pr] of ghPRs.entries()) {
    let details = { additions: 0, deletions: 0, changed_files: 0 };
    try {
      details = await fetchPRDetails(owner, name, pr.number);
    } catch {
    }

    const dbPR = prsDb.upsert({
      repo_id: repoId,
      github_number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      author: pr.user?.login || 'unknown',
      author_avatar: pr.user?.avatar_url || null,
      labels: JSON.stringify(pr.labels.map((l) => l.name)),
      additions: details.additions,
      deletions: details.deletions,
      changed_files: details.changed_files,
      draft: pr.draft ? 1 : 0,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      merged_at: pr.merged_at,
      closed_at: pr.closed_at,
    });
    prMap.set(pr.number, dbPR.id);
    await onProgress?.('pr', index + 1, ghPRs.length, pr);
  }

  for (const pr of ghPRs) {
    const text = pr.title + ' ' + (pr.body || '');
    const refs = extractIssueReferences(text);
    const prDbId = prMap.get(pr.number);
    if (!prDbId) continue;

    for (const ref of refs) {
      const issueDbId = issueMap.get(ref.issueNumber);
      if (issueDbId) {
        relationshipsDb.create({
          issue_id: issueDbId,
          pr_id: prDbId,
          relationship_type: ref.type,
          confidence: 1.0,
        });
      }
    }
  }

  return {
    issues: ghIssues.length,
    pullRequests: ghPRs.length,
  };
}
