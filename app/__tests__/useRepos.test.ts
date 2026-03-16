import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRepos } from '../hooks/useRepos';

const repository = {
  id: 1,
  owner: 'pingdotgg',
  name: 't3code',
  full_name: 'pingdotgg/t3code',
  description: 'repo',
  stars: 1,
  open_issues_count: 2,
  open_prs_count: 3,
};

describe('useRepos', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores running analysis progress after a refresh and resumes polling', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([repository]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 42,
        status: 'running',
        progress: 35,
        error: null,
        started_at: null,
        completed_at: null,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 42,
        status: 'running',
        progress: 35,
        error: null,
        started_at: null,
        completed_at: null,
      }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const { result, unmount } = renderHook(() => useRepos());

    await waitFor(() => {
      expect(result.current.analysisProgress[1]).toEqual({
        progress: 35,
        status: 'running',
      });
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/repos');
    expect(fetchMock).toHaveBeenCalledWith('/api/repos/1/jobs', { cache: 'no-store' });

    unmount();
  });
});
