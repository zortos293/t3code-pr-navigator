'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Comment, PRFile, DetailItem, Relationship } from '@/app/lib/types';
import type { Issue, PullRequest } from '@/app/lib/db';

type DetailContentState = {
  comments: Comment[];
  loadingComments: boolean;
  prFiles: PRFile[];
  loadingFiles: boolean;
  linkedItems: DetailItem[];
};

export function useDetailContent(
  detail: DetailItem | null,
  repoFullName: string,
  relationships: Relationship[],
  issues: Issue[],
  pullRequests: PullRequest[]
): DetailContentState {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [prFiles, setPrFiles] = useState<PRFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    if (!detail) {
      setComments([]);
      setPrFiles([]);
      return;
    }

    const [owner, name] = repoFullName.split('/');
    const number = detail.item.github_number;

    setLoadingComments(true);
    setComments([]);

    fetch(`/api/comments?owner=${owner}&name=${name}&number=${number}&repoId=${detail.item.repo_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setComments(data);
      })
      .catch(() => {})
      .finally(() => setLoadingComments(false));

    if (detail.type === 'pr') {
      setLoadingFiles(true);
      setPrFiles([]);
      fetch(`/api/pr-files?owner=${owner}&name=${name}&number=${number}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setPrFiles(data);
        })
        .catch(() => {})
        .finally(() => setLoadingFiles(false));
    } else {
      setPrFiles([]);
    }
  }, [detail, repoFullName]);

  const linkedItems = useMemo(() => {
    if (!detail) return [];
    const result: DetailItem[] = [];

    if (detail.type === 'issue') {
      const issueId = detail.item.id;
      const linkedPrIds = relationships
        .filter((r) => r.issue_id === issueId)
        .map((r) => r.pr_id);
      for (const prId of linkedPrIds) {
        const pr = pullRequests.find((p) => p.id === prId);
        if (pr) result.push({ type: 'pr', item: pr });
      }
    } else {
      const prId = detail.item.id;
      const linkedIssueIds = relationships
        .filter((r) => r.pr_id === prId)
        .map((r) => r.issue_id);
      for (const issueId of linkedIssueIds) {
        const issue = issues.find((i) => i.id === issueId);
        if (issue) result.push({ type: 'issue', item: issue });
      }
    }

    return result;
  }, [detail, relationships, issues, pullRequests]);

  return { comments, loadingComments, prFiles, loadingFiles, linkedItems };
}
