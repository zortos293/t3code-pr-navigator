'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Issue, PullRequest } from '@/app/lib/db';
import { projectRepoBoardData } from '@/app/lib/repoView';
import type { ActivityEvent } from '@/app/lib/types';

type Relationship = {
  id: number;
  issue_id: number;
  pr_id: number;
  relationship_type: string;
  confidence: number;
  issue_number: number;
  pr_number: number;
};

type Duplicate = {
  id: number;
  original_issue_id: number;
  duplicate_issue_id: number;
  confidence: number;
  reason: string | null;
  original_number: number;
  duplicate_number: number;
};

type BoardData = {
  issues: Issue[];
  pullRequests: PullRequest[];
  relationships: Relationship[];
  duplicates: Duplicate[];
  activity: ActivityEvent[];
  repoFullName: string;
  openPullRequestCount: number;
  trackedPullRequestCount: number;
  loading: boolean;
};

export function useBoard(repoId: number | null) {
  const [data, setData] = useState<BoardData>({
    issues: [],
    pullRequests: [],
    relationships: [],
    duplicates: [],
    activity: [],
    repoFullName: '',
    openPullRequestCount: 0,
    trackedPullRequestCount: 0,
    loading: false,
  });

  const fetchBoard = useCallback(async () => {
    if (!repoId) {
      setData({
        issues: [],
        pullRequests: [],
        relationships: [],
        duplicates: [],
        activity: [],
        repoFullName: '',
        openPullRequestCount: 0,
        trackedPullRequestCount: 0,
        loading: false,
      });
      return;
    }

    setData((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/repos/${repoId}`);
      if (!res.ok) throw new Error('Failed to fetch board data');
      const repo = await res.json();
      const projection = projectRepoBoardData(
        repo.issues || [],
        repo.pull_requests || [],
        repo.relationships || [],
      );
      setData({
        issues: projection.openIssues,
        pullRequests: projection.visiblePullRequests,
        relationships: projection.visibleRelationships,
        duplicates: repo.duplicates || [],
        activity: repo.activity || [],
        repoFullName: repo.full_name || '',
        openPullRequestCount: projection.openPullRequestCount,
        trackedPullRequestCount: projection.trackedPullRequestCount,
        loading: false,
      });
    } catch {
      setData((prev) => ({ ...prev, loading: false }));
    }
  }, [repoId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const createRelationship = useCallback(async (issueId: number, prId: number) => {
    try {
      await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, pr_id: prId }),
      });
      fetchBoard();
    } catch {
      // ignore
    }
  }, [fetchBoard]);

  const deleteRelationship = useCallback(async (id: number) => {
    try {
      await fetch(`/api/relationships?id=${id}`, { method: 'DELETE' });
      fetchBoard();
    } catch {
      // ignore
    }
  }, [fetchBoard]);

  return { ...data, createRelationship, deleteRelationship, refresh: fetchBoard };
}
