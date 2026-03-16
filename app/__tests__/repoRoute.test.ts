import { describe, expect, it, vi, beforeEach } from 'vitest';

const reposMock = {
  getById: vi.fn(),
};

const issuesMock = {
  getByRepoId: vi.fn(),
};

const pullRequestsMock = {
  getByRepoId: vi.fn(),
};

const relationshipsMock = {
  getByRepoId: vi.fn(),
};

const duplicatesMock = {
  getByRepoId: vi.fn(),
};

vi.mock('@/app/lib/db', () => ({
  repos: reposMock,
  issues: issuesMock,
  pullRequests: pullRequestsMock,
  relationships: relationshipsMock,
  duplicates: duplicatesMock,
}));

describe('GET /api/repos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides closed issues and pull requests from the dashboard payload', async () => {
    reposMock.getById.mockResolvedValue({
      id: 1,
      owner: 'pingdotgg',
      name: 't3code',
      full_name: 'pingdotgg/t3code',
      description: null,
      stars: 0,
      open_issues_count: 1,
      open_prs_count: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    issuesMock.getByRepoId.mockResolvedValue([
      { id: 1, repo_id: 1, github_number: 11, title: 'Open', body: null, state: 'open', author: 'a', author_avatar: null, labels: null, created_at: null, updated_at: null, closed_at: null },
      { id: 2, repo_id: 1, github_number: 12, title: 'Closed', body: null, state: 'closed', author: 'a', author_avatar: null, labels: null, created_at: null, updated_at: null, closed_at: '2026-01-02T00:00:00.000Z' },
    ]);
    pullRequestsMock.getByRepoId.mockResolvedValue([
      { id: 10, repo_id: 1, github_number: 21, title: 'Open PR', body: null, state: 'open', author: 'b', author_avatar: null, labels: null, additions: 0, deletions: 0, changed_files: 0, draft: 0, created_at: null, updated_at: null, merged_at: null, closed_at: null },
      { id: 11, repo_id: 1, github_number: 22, title: 'Closed PR', body: null, state: 'closed', author: 'b', author_avatar: null, labels: null, additions: 0, deletions: 0, changed_files: 0, draft: 0, created_at: null, updated_at: null, merged_at: null, closed_at: '2026-01-03T00:00:00.000Z' },
    ]);
    relationshipsMock.getByRepoId.mockResolvedValue([
      { id: 100, issue_id: 1, pr_id: 10, relationship_type: 'solves', confidence: 1, issue_number: 11, pr_number: 21 },
      { id: 101, issue_id: 2, pr_id: 11, relationship_type: 'solves', confidence: 1, issue_number: 12, pr_number: 22 },
    ]);
    duplicatesMock.getByRepoId.mockResolvedValue([
      { id: 200, original_issue_id: 1, duplicate_issue_id: 2, confidence: 0.8, reason: null, original_number: 11, duplicate_number: 12 },
    ]);

    const { GET } = await import('../api/repos/[id]/route');
    const response = await GET(new Request('http://localhost/api/repos/1') as never, {
      params: Promise.resolve({ id: '1' }),
    });
    const payload = await response.json();

    expect(payload.issues).toHaveLength(1);
    expect(payload.pull_requests).toHaveLength(1);
    expect(payload.relationships).toEqual([
      expect.objectContaining({ id: 100, issue_id: 1, pr_id: 10 }),
    ]);
    expect(payload.duplicates).toEqual([]);
  });
});
