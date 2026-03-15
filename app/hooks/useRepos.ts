'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RepoSummary } from '@/app/components/Sidebar';

type AnalysisJob = {
  id: number;
  status: string;
  progress: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type AnalysisProgress = Record<number, { progress: number; status: string }>;

export function useRepos() {
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

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

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
    if (!res.ok) throw new Error(data.error || 'Failed to fetch analysis progress');
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
    const res = await fetch(`/api/repos/${id}/sync`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to sync repository');
    await fetchRepos();
  }, [fetchRepos]);

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
          const error = err instanceof Error ? err : new Error('Failed to poll analysis progress');
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
      if (!res.ok) throw new Error(data.error || 'Failed to analyze repository');
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
        throw new Error('Analysis job did not start');
      }

      if (finalJob.status === 'failed') {
        throw new Error(finalJob.error || 'Analysis failed');
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
