import type { Issue, PullRequest } from './db';
import type { Relationship, Cluster } from './types';

export type ClusterResult = {
  clusters: Cluster[];
  standaloneIssues: Issue[];
  standalonePrs: PullRequest[];
};

function getSortableTimestamp(dateStr: string | null): number {
  if (!dateStr) return Number.NEGATIVE_INFINITY;

  const timestamp = new Date(dateStr).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function buildClusters(
  issues: Issue[],
  pullRequests: PullRequest[],
  relationships: Relationship[]
): ClusterResult {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const linkedIssueIds = new Set<number>();
  const linkedPrIds = new Set<number>();

  const issueMap = new Map(issues.map((i) => [i.id, i]));
  const prMap = new Map(pullRequests.map((p) => [p.id, p]));

  for (const rel of relationships) {
    if (!issueMap.has(rel.issue_id) || !prMap.has(rel.pr_id)) continue;
    union(`i-${rel.issue_id}`, `p-${rel.pr_id}`);
    linkedIssueIds.add(rel.issue_id);
    linkedPrIds.add(rel.pr_id);
  }

  const clusterMap = new Map<string, { issueIds: Set<number>; prIds: Set<number> }>();

  for (const rel of relationships) {
    if (!issueMap.has(rel.issue_id) || !prMap.has(rel.pr_id)) continue;
    const root = find(`i-${rel.issue_id}`);
    if (!clusterMap.has(root)) {
      clusterMap.set(root, { issueIds: new Set(), prIds: new Set() });
    }
    const c = clusterMap.get(root)!;
    c.issueIds.add(rel.issue_id);
    c.prIds.add(rel.pr_id);
  }

  const clusters: Cluster[] = [];
  for (const [, c] of clusterMap) {
    const clusterIssues = [...c.issueIds].map((id) => issueMap.get(id)!).filter(Boolean);
    const clusterPrs = [...c.prIds].map((id) => prMap.get(id)!).filter(Boolean);
    if (clusterIssues.length > 0 || clusterPrs.length > 0) {
      clusters.push({ issues: clusterIssues, prs: clusterPrs });
    }
  }

  clusters.sort((a, b) => {
    const latestA = Math.max(
      ...a.issues.map((issue) => getSortableTimestamp(issue.created_at)),
      ...a.prs.map((pr) => getSortableTimestamp(pr.created_at))
    );
    const latestB = Math.max(
      ...b.issues.map((issue) => getSortableTimestamp(issue.created_at)),
      ...b.prs.map((pr) => getSortableTimestamp(pr.created_at))
    );
    if (latestA !== latestB) return latestB - latestA;

    const sizeA = a.issues.length + a.prs.length;
    const sizeB = b.issues.length + b.prs.length;
    if (sizeA !== sizeB) return sizeB - sizeA;
    const numA = a.issues[0]?.github_number ?? Infinity;
    const numB = b.issues[0]?.github_number ?? Infinity;
    return numA - numB;
  });

  const standaloneIssues = issues.filter((i) => !linkedIssueIds.has(i.id));
  const standalonePrs = pullRequests.filter((p) => !linkedPrIds.has(p.id));

  return { clusters, standaloneIssues, standalonePrs };
}
