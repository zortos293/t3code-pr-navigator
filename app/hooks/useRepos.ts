'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RepoSummary } from '@/app/components/Sidebar';
import type { SyncToastData } from '@/app/hooks/useSyncProgress';

type SyncProgressHandlers = {
  showSyncToast: (toast: SyncToastData) => void;
  updateSyncToast: (toast: SyncToastData) => void;
  dismissToast: (id: string) => void;
};

type SyncEvent =
  | { type: 'progress'; entityType: 'issue' | 'pr'; current: number; total: number; number: number; repoName: string }
  | { type: 'complete'; issues: number; pullRequests: number }
  | { type: 'error'; error: string };

async function readSyncStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: SyncEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';

    for (const chunk of chunks) {
      const payload = chunk
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('');

      if (!payload) continue;
      onEvent(JSON.parse(payload) as SyncEvent);
    }
  }

  const finalPayload = buffer
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6))
    .join('');

  if (finalPayload) {
    onEvent(JSON.parse(finalPayload) as SyncEvent);
  }
}

export function useRepos(syncProgress?: SyncProgressHandlers) {
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
    const res = await fetch(`/api/repos/${id}/sync`, {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
    });

    if (!res.ok) {
      let message = 'Failed to sync repository';
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
      }
      throw new Error(message);
    }

    if (!res.body) {
      throw new Error('Sync stream unavailable');
    }

    let syncError: string | null = null;

    await readSyncStream(res.body, (event) => {
      if (event.type === 'progress' && event.total > 0) {
        const toast = {
          id: `${id}-${event.entityType}`,
          repoName: event.repoName,
          type: event.entityType,
          current: event.current,
          total: event.total,
          number: event.number,
        } satisfies SyncToastData;

        if (event.current === 1) {
          syncProgress?.showSyncToast(toast);
        } else {
          syncProgress?.updateSyncToast(toast);
        }

        if (event.current === event.total) {
          syncProgress?.updateSyncToast(toast);
        }
      }

      if (event.type === 'error') {
        syncError = event.error;
        syncProgress?.dismissToast(`${id}-issue`);
        syncProgress?.dismissToast(`${id}-pr`);
      }
    });

    if (syncError) {
      throw new Error(syncError);
    }

    await fetchRepos();
  }, [fetchRepos, syncProgress]);

  const analyzeRepo = useCallback(async (id: number) => {
    const res = await fetch(`/api/repos/${id}/analyze`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to analyze repository');
    return data;
  }, []);

  return { repos, loading, error, addRepo, deleteRepo, syncRepo, analyzeRepo, refresh: fetchRepos };
}
