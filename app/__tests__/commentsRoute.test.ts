import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const commentCachesMock = {
  getByRepoAndGitHubNumber: vi.fn(),
  upsert: vi.fn(),
};

const fetchCommentsMock = vi.fn();

vi.mock('@/app/lib/db', () => ({
  commentCaches: commentCachesMock,
}));

vi.mock('@/app/lib/github', () => ({
  fetchComments: fetchCommentsMock,
}));

describe('GET /api/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached comments without refetching from GitHub', async () => {
    const cachedComments = [
      {
        id: 1,
        body: 'cached',
        author: 'octocat',
        author_avatar: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    commentCachesMock.getByRepoAndGitHubNumber.mockResolvedValue({
      repo_id: 7,
      github_number: 42,
      comments: cachedComments,
      fetched_at: '2026-01-02T00:00:00.000Z',
    });

    const { GET } = await import('../api/comments/route');
    const request = new NextRequest('http://localhost/api/comments?owner=pingdotgg&name=t3code&number=42&repoId=7');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(cachedComments);
    expect(fetchCommentsMock).not.toHaveBeenCalled();
    expect(commentCachesMock.upsert).not.toHaveBeenCalled();
  });

  it('fetches and caches comments when no cache entry exists', async () => {
    const fetchedComments = [
      {
        id: 2,
        body: 'fresh',
        author: 'hubot',
        author_avatar: 'https://example.com/avatar.png',
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      },
    ];

    commentCachesMock.getByRepoAndGitHubNumber.mockResolvedValue(undefined);
    fetchCommentsMock.mockResolvedValue(fetchedComments);
    commentCachesMock.upsert.mockResolvedValue({
      repo_id: 7,
      github_number: 42,
      comments: fetchedComments,
      fetched_at: '2026-01-04T00:00:00.000Z',
    });

    const { GET } = await import('../api/comments/route');
    const request = new NextRequest('http://localhost/api/comments?owner=pingdotgg&name=t3code&number=42&repoId=7');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(fetchedComments);
    expect(fetchCommentsMock).toHaveBeenCalledWith('pingdotgg', 't3code', 42);
    expect(commentCachesMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        repo_id: 7,
        github_number: 42,
        comments: fetchedComments,
      })
    );
  });
});
