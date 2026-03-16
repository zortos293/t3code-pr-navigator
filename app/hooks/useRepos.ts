'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

type AnalysisJob = {
  id: number;
  status: string;
  progress: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type AnalysisProgress = Record<number, { progress: number; status: string }>;
type RepoAnalysisJob = { repoId: number; job: AnalysisJob | null };

export function useRepos(syncProgress?: SyncProgressHandlers) {
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({});
  const pollingIntervals = useRef<Record<number, number>>({});

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

  const stopPolling = useCallback((repoId: number) => {
    const intervalId = pollingIntervals.current[repoId];
    if (intervalId) {
      window.clearInterval(intervalId);
      delete pollingIntervals.current[repoId];
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(pollingIntervals.current).forEach((intervalId) => window.clearInterval(intervalId));
      pollingIntervals.current = {};
    };
  }, []);

  const fetchLatestAnalysisJob = useCallback(async (repoId: number) => {
    const res = await fetch(`/api/repos/${repoId}/jobs`, {
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch OpenCode analysis progress');
    return data as AnalysisJob | null;
  }, []);

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
    stopPolling(id);
    const res = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete repository');
    setAnalysisProgress((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    await fetchRepos();
  }, [fetchRepos, stopPolling]);

  const syncRepo = useCallback(async (id: number) => {
    const res = await fetch(`/api/repos/${id}/sync`, {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
    });

    if (!res.ok) {
      let message = 'Failed to sync repository';
      if (res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json() as { error?: string };
        message = data.error || message;
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

  const pollAnalysisProgress = useCallback((repoId: number, jobId?: number) => {
    stopPolling(repoId);

    return new Promise<AnalysisJob | null>((resolve, reject) => {
      let settled = false;
      let inFlight = false;

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        stopPolling(repoId);
        callback();
      };

      const checkProgress = async () => {
        if (inFlight || settled) return;
        inFlight = true;

        try {
          const job = await fetchLatestAnalysisJob(repoId);

          if (jobId && job && job.id !== jobId) {
            return;
          }

          if (job) {
            setAnalysisProgress((current) => ({
              ...current,
              [repoId]: {
                progress: job.progress,
                status: job.status,
              },
            }));

            if (job.status === 'completed' || job.status === 'failed') {
              settle(() => resolve(job));
            }
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to poll OpenCode analysis progress');
          settle(() => reject(error));
        } finally {
          inFlight = false;
        }
      };

      void checkProgress();
      pollingIntervals.current[repoId] = window.setInterval(() => {
        void checkProgress();
      }, 1000);
    });
  }, [fetchLatestAnalysisJob, stopPolling]);

  const restoreAnalysisProgress = useCallback(async (repoList: RepoSummary[]) => {
    if (repoList.length === 0) {
      setAnalysisProgress({});
      return;
    }

    const results = await Promise.all(
      repoList.map(async (repo): Promise<RepoAnalysisJob> => {
        try {
          return { repoId: repo.id, job: await fetchLatestAnalysisJob(repo.id) };
        } catch {
          return { repoId: repo.id, job: null };
        }
      })
    );

    setAnalysisProgress((current) => {
      const next: AnalysisProgress = {};

      for (const { repoId, job } of results) {
        if (!job) {
          if (current[repoId]?.status === 'running') {
            next[repoId] = current[repoId];
          }
          continue;
        }

        if (job.status !== 'completed') {
          next[repoId] = {
            progress: job.progress,
            status: job.status,
          };
        }
      }

      return next;
    });

    for (const { repoId, job } of results) {
      if (job?.status === 'running') {
        void pollAnalysisProgress(repoId, job.id).catch(() => undefined);
      } else {
        stopPolling(repoId);
      }
    }
  }, [fetchLatestAnalysisJob, pollAnalysisProgress, stopPolling]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  useEffect(() => {
    void restoreAnalysisProgress(repos);
  }, [repos, restoreAnalysisProgress]);

  const analyzeRepo = useCallback(async (id: number) => {
    stopPolling(id);
    setAnalysisProgress((current) => ({
      ...current,
      [id]: {
        progress: current[id]?.progress ?? 0,
        status: 'running',
      },
    }));

    try {
      const res = await fetch(`/api/repos/${id}/analyze`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run OpenCode analysis');
      if (data.job) {
        setAnalysisProgress((current) => ({
          ...current,
          [id]: {
            progress: data.job.progress,
            status: data.job.status,
          },
        }));
      }

      const finalJob = await pollAnalysisProgress(id, data.job?.id);

      if (!finalJob) {
        throw new Error('OpenCode analysis job did not start');
      }

      if (finalJob.status === 'failed') {
        throw new Error(finalJob.error || 'OpenCode analysis failed');
      }

      return finalJob;
    } catch (error) {
      setAnalysisProgress((current) => {
        const next = { ...current };
        if (next[id]?.status !== 'failed') {
          delete next[id];
        }
        return next;
      });
      throw error;
    }
  }, [pollAnalysisProgress, stopPolling]);

  return {
    repos,
    loading,
    error,
    analysisProgress,
    addRepo,
    deleteRepo,
    syncRepo,
    analyzeRepo,
    pollAnalysisProgress,
    refresh: fetchRepos,
  };
}
