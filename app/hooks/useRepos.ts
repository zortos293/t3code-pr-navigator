'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RepoSummary } from '@/app/components/Sidebar';

export function useRepos() {
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await fetch('/api/repos');
      if (!res.ok) throw new Error('Failed to fetch repos');
      const data = await res.json();
      setRepos(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const addRepo = useCallback(async (url: string) => {
    const res = await fetch('/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add repository');
    await fetchRepos();
    return data;
  }, [fetchRepos]);

  const deleteRepo = useCallback(async (id: number) => {
    const res = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete repository');
    await fetchRepos();
  }, [fetchRepos]);

  const syncRepo = useCallback(async (id: number) => {
    const res = await fetch(`/api/repos/${id}/sync`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to sync repository');
    await fetchRepos();
  }, [fetchRepos]);

  const analyzeRepo = useCallback(async (id: number) => {
    const res = await fetch(`/api/repos/${id}/analyze`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to analyze repository');
    return data;
  }, []);

  return { repos, loading, error, addRepo, deleteRepo, syncRepo, analyzeRepo, refresh: fetchRepos };
}
