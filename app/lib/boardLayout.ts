import type { Node } from '@xyflow/react';
import type { Issue, PullRequest } from './db';
import type { Relationship } from './types';
import type { IssueNodeData } from '../components/Board/IssueNode';
import type { PRNodeData } from '../components/Board/PRNode';
import type { LaneHeaderData } from '../components/Board/LaneHeaderNode';
import { buildClusters } from './clustering';
import { parseLabels } from './parseLabels';
import { sortPullRequestsForBoard } from './pullRequestFilters';
import {
  HEADER_X,
  CONTENT_X,
  ISSUE_WIDTH,
  PR_WIDTH,
  PAIR_GAP,
  ISSUE_STACK_STEP,
  PR_STACK_STEP,
  CLUSTER_H_GAP,
  CLUSTER_V_GAP,
  SECTION_GAP,
  HEADER_HEIGHT,
  HEADER_CONTENT_GAP,
  MAX_CLUSTERS_PER_ROW,
  ISSUE_CARD_HEIGHT,
  PR_CARD_HEIGHT,
  GROUP_PADDING,
  STANDALONE_ISSUE_GAP_X,
  STANDALONE_ISSUE_GAP_Y,
  STANDALONE_PR_GAP_X,
  STANDALONE_PR_GAP_Y,
  MAX_STANDALONE_PER_ROW,
} from './boardConfig';

const BUG_PATTERN = /\bbugs?\b/i;
const FEATURE_PATTERN = /\b(?:features?|feat|enhancements?|enchancements?)\b/i;

type StandaloneCategory = 'bug' | 'feature' | 'uncategorized';
type StandaloneItem = {
  title: string;
  labels: string | null;
  created_at: string | null;
  github_number: number;
};

function getStandaloneCategory(item: Pick<StandaloneItem, 'title' | 'labels'>): StandaloneCategory {
  const searchableText = [item.title, ...parseLabels(item.labels)].join(' ');

  if (BUG_PATTERN.test(searchableText)) return 'bug';
  if (FEATURE_PATTERN.test(searchableText)) return 'feature';

  return 'uncategorized';
}

function getSortableTimestamp(dateStr: string | null): number {
  if (!dateStr) return Number.NEGATIVE_INFINITY;

  const timestamp = new Date(dateStr).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function sortItemsNewestFirst<T extends Pick<StandaloneItem, 'created_at' | 'github_number'>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const timestampDiff = getSortableTimestamp(b.created_at) - getSortableTimestamp(a.created_at);
    if (timestampDiff !== 0) return timestampDiff;

    return b.github_number - a.github_number;
  });
}

function groupStandaloneItems<T extends StandaloneItem>(items: T[]): Record<StandaloneCategory, T[]> {
  const grouped: Record<StandaloneCategory, T[]> = {
    bug: [],
    feature: [],
    uncategorized: [],
  };

  for (const item of sortItemsNewestFirst(items)) {
    grouped[getStandaloneCategory(item)].push(item);
  }

  return grouped;
}

function sortClusterItemsForLayout(
  issues: Issue[],
  pullRequests: PullRequest[],
  relationships: Relationship[]
): { issues: Issue[]; pullRequests: PullRequest[] } {
  const fallbackIssues = sortItemsNewestFirst(issues);
  const fallbackPullRequests = sortPullRequestsForBoard(pullRequests);
  if (relationships.length === 0) {
    return { issues: fallbackIssues, pullRequests: fallbackPullRequests };
  }

  const prIdsByIssue = new Map<number, number[]>();
  const issueIdsByPr = new Map<number, number[]>();

  for (const relationship of relationships) {
    const issuePrIds = prIdsByIssue.get(relationship.issue_id) ?? [];
    issuePrIds.push(relationship.pr_id);
    prIdsByIssue.set(relationship.issue_id, issuePrIds);

    const prIssueIds = issueIdsByPr.get(relationship.pr_id) ?? [];
    prIssueIds.push(relationship.issue_id);
    issueIdsByPr.set(relationship.pr_id, prIssueIds);
  }

  const sortByConnectedOrder = <T extends Issue | PullRequest>(
    items: T[],
    getConnectedIds: (item: T) => number[] | undefined,
    oppositeOrder: number[],
    fallbackOrder: T[]
  ): T[] => {
    const oppositeIndex = new Map(oppositeOrder.map((id, index) => [id, index]));
    const fallbackIndex = new Map(fallbackOrder.map((item, index) => [item.id, index]));

    return [...items].sort((a, b) => {
      const connectedA = getConnectedIds(a) ?? [];
      const connectedB = getConnectedIds(b) ?? [];

      const averageIndex = (connectedIds: number[]) => {
        const indices = connectedIds
          .map((id) => oppositeIndex.get(id))
          .filter((value): value is number => value !== undefined);

        if (indices.length === 0) {
          return Number.POSITIVE_INFINITY;
        }

        return indices.reduce((sum, value) => sum + value, 0) / indices.length;
      };

      const averageA = averageIndex(connectedA);
      const averageB = averageIndex(connectedB);

      if (averageA !== averageB) {
        return averageA - averageB;
      }

      return (fallbackIndex.get(a.id) ?? 0) - (fallbackIndex.get(b.id) ?? 0);
    });
  };

  let orderedIssues = fallbackIssues;
  let orderedPullRequests = fallbackPullRequests;

  for (let pass = 0; pass < 2; pass++) {
    orderedPullRequests = sortByConnectedOrder(
      orderedPullRequests,
      (pullRequest) => issueIdsByPr.get(pullRequest.id),
      orderedIssues.map((issue) => issue.id),
      fallbackPullRequests
    );
    orderedIssues = sortByConnectedOrder(
      orderedIssues,
      (issue) => prIdsByIssue.get(issue.id),
      orderedPullRequests.map((pullRequest) => pullRequest.id),
      fallbackIssues
    );
  }

  return { issues: orderedIssues, pullRequests: orderedPullRequests };
}

export function createIssueNode(
  issue: Issue,
  repoFullName: string,
  position: { x: number; y: number }
): Node {
  return {
    id: `issue-${issue.id}`,
    type: 'issue',
    position,
    data: {
      github_number: issue.github_number,
      title: issue.title,
      state: issue.state,
      author: issue.author,
      author_avatar: issue.author_avatar,
      labels: parseLabels(issue.labels),
      repo_full_name: repoFullName,
    } satisfies IssueNodeData,
  };
}

export function createPrNode(
  pr: PullRequest,
  repoFullName: string,
  position: { x: number; y: number }
): Node {
  return {
    id: `pr-${pr.id}`,
    type: 'pr',
    position,
    data: {
      github_number: pr.github_number,
      title: pr.title,
      state: pr.state,
      author: pr.author,
      author_avatar: pr.author_avatar,
      labels: parseLabels(pr.labels),
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
      draft: !!pr.draft,
      repo_full_name: repoFullName,
    } satisfies PRNodeData,
  };
}

function buildStandaloneSection(
  items: (Issue | PullRequest)[],
  createNode: (item: Issue | PullRequest, pos: { x: number; y: number }) => Node,
  cardWidth: number,
  cardHeight: number,
  gapX: number,
  gapY: number,
  sectionId: string,
  sectionTitle: string,
  sectionSubtitle: string,
  currentY: number
): { nodes: Node[]; nextY: number } {
  if (items.length === 0) return { nodes: [], nextY: currentY };

  let maxContentX = CONTENT_X;
  const contentNodes: Node[] = [];
  const contentStartY = currentY + HEADER_HEIGHT + HEADER_CONTENT_GAP;

  let x = CONTENT_X;
  let rowY = contentStartY;
  let cardsInRow = 0;
  let rowMaxHeight = 0;

  for (const item of items) {
    if (cardsInRow >= MAX_STANDALONE_PER_ROW && cardsInRow > 0) {
      rowY += rowMaxHeight + gapY;
      x = CONTENT_X;
      cardsInRow = 0;
      rowMaxHeight = 0;
    }
    contentNodes.push(createNode(item, { x, y: rowY }));
    maxContentX = Math.max(maxContentX, x + cardWidth);
    x += cardWidth + gapX;
    rowMaxHeight = Math.max(rowMaxHeight, cardHeight);
    cardsInRow++;
  }

  const headerWidth = Math.max(600, maxContentX - HEADER_X + 20);
  const headerNode: Node = {
    id: `lane-${sectionId}`,
    type: 'lane-header',
    position: { x: HEADER_X, y: currentY },
    data: {
      title: sectionTitle,
      subtitle: sectionSubtitle,
      count: items.length,
      variant: 'other',
      width: headerWidth,
    } satisfies LaneHeaderData,
    draggable: false,
    selectable: false,
    connectable: false,
  };

  return {
    nodes: [headerNode, ...contentNodes],
    nextY: rowY + rowMaxHeight + SECTION_GAP,
  };
}

export function buildClusteredNodes(
  issues: Issue[],
  pullRequests: PullRequest[],
  relationships: Relationship[],
  repoFullName: string
): Node[] {
  const { clusters, standaloneIssues, standalonePrs } = buildClusters(
    issues,
    pullRequests,
    relationships
  );

  const allNodes: Node[] = [];
  let currentY = 0;
  const groupedStandaloneIssues = groupStandaloneItems(standaloneIssues);
  const standalonePrGroups = groupStandaloneItems(standalonePrs);
  const groupedStandalonePrs = {
    bug: sortPullRequestsForBoard(standalonePrGroups.bug),
    feature: sortPullRequestsForBoard(standalonePrGroups.feature),
    uncategorized: sortPullRequestsForBoard(standalonePrGroups.uncategorized),
  };

  /* ── Section: Connected Work ─────────────────────────────── */
  if (clusters.length > 0) {
    const connectedCount = clusters.reduce(
      (sum, c) => sum + c.issues.length + c.prs.length,
      0
    );

    let maxContentX = CONTENT_X;
    const contentNodes: Node[] = [];
    const contentStartY = currentY + HEADER_HEIGHT + HEADER_CONTENT_GAP;

    let clusterX = CONTENT_X;
    let rowStartY = contentStartY;
    let rowMaxHeight = 0;
    let clustersInRow = 0;

    for (const cluster of clusters) {
      const clusterRelationships = relationships.filter(
        (relationship) =>
          cluster.issues.some((issue) => issue.id === relationship.issue_id) &&
          cluster.prs.some((pr) => pr.id === relationship.pr_id)
      );
      const orderedCluster = sortClusterItemsForLayout(
        cluster.issues,
        cluster.prs,
        clusterRelationships
      );
      const issueCount = orderedCluster.issues.length;
      const prCount = orderedCluster.pullRequests.length;
      const issueStackH = issueCount > 0 ? (issueCount - 1) * ISSUE_STACK_STEP + ISSUE_CARD_HEIGHT : 0;
      const prStackH = prCount > 0 ? (prCount - 1) * PR_STACK_STEP + PR_CARD_HEIGHT : 0;
      const clusterContentH = Math.max(issueStackH, prStackH);
      const clusterWidth = ISSUE_WIDTH + PAIR_GAP + PR_WIDTH;

      if (clustersInRow >= MAX_CLUSTERS_PER_ROW && clustersInRow > 0) {
        rowStartY += rowMaxHeight + CLUSTER_V_GAP;
        clusterX = CONTENT_X;
        rowMaxHeight = 0;
        clustersInRow = 0;
      }

      // Group background
      contentNodes.push({
        id: `cluster-bg-${cluster.issues[0]?.id ?? cluster.prs[0]?.id}`,
        type: 'cluster-group',
        position: {
          x: clusterX - GROUP_PADDING,
          y: rowStartY - GROUP_PADDING,
        },
        data: {
          width: clusterWidth + GROUP_PADDING * 2,
          height: clusterContentH + GROUP_PADDING * 2,
        },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -1,
      });

      orderedCluster.issues.forEach((issue, idx) => {
        contentNodes.push(
          createIssueNode(issue, repoFullName, {
            x: clusterX,
            y: rowStartY + idx * ISSUE_STACK_STEP,
          })
        );
      });

      orderedCluster.pullRequests.forEach((pr, idx) => {
        contentNodes.push(
          createPrNode(pr, repoFullName, {
            x: clusterX + ISSUE_WIDTH + PAIR_GAP,
            y: rowStartY + idx * PR_STACK_STEP,
          })
        );
      });

      maxContentX = Math.max(maxContentX, clusterX + clusterWidth);
      rowMaxHeight = Math.max(rowMaxHeight, clusterContentH);
      clusterX += clusterWidth + CLUSTER_H_GAP;
      clustersInRow++;
    }

    const headerWidth = Math.max(600, maxContentX - HEADER_X + 20);
    allNodes.push({
      id: 'lane-connected',
      type: 'lane-header',
      position: { x: HEADER_X, y: currentY },
      data: {
        title: 'Connected Work',
        subtitle: 'Issues linked to pull requests',
        count: connectedCount,
        variant: 'linked',
        width: headerWidth,
      } satisfies LaneHeaderData,
      draggable: false,
      selectable: false,
      connectable: false,
    });

    allNodes.push(...contentNodes);
    currentY = rowStartY + rowMaxHeight + SECTION_GAP;
  }

  /* ── Sections: Standalone Issues ─────────────────────────── */
  const standaloneIssueSections = [
    {
      id: 'bugs',
      items: groupedStandaloneIssues.bug,
      title: 'Bugs',
      subtitle: 'Not linked to any pull request',
    },
    {
      id: 'features',
      items: groupedStandaloneIssues.feature,
      title: 'Features',
      subtitle: 'Not linked to any pull request',
    },
    {
      id: 'uncategorized',
      items: groupedStandaloneIssues.uncategorized,
      title: 'Uncategorized',
      subtitle: 'Not linked to any pull request',
    },
  ];

  for (const section of standaloneIssueSections) {
    const issueSection = buildStandaloneSection(
      section.items,
      (item, pos) => createIssueNode(item as Issue, repoFullName, pos),
      ISSUE_WIDTH,
      ISSUE_CARD_HEIGHT,
      STANDALONE_ISSUE_GAP_X,
      STANDALONE_ISSUE_GAP_Y,
      section.id,
      section.title,
      section.subtitle,
      currentY
    );
    allNodes.push(...issueSection.nodes);
    currentY = issueSection.nextY;
  }

  /* ── Sections: Standalone Pull Requests ──────────────────── */
  const standalonePrSections = [
    {
      id: 'pull-request-bugs',
      items: groupedStandalonePrs.bug,
      title: 'Bug Fix Pull Requests',
      subtitle: 'Not linked to any issue',
    },
    {
      id: 'pull-request-features',
      items: groupedStandalonePrs.feature,
      title: 'Feature Pull Requests',
      subtitle: 'Not linked to any issue',
    },
    {
      id: 'pull-request-uncategorized',
      items: groupedStandalonePrs.uncategorized,
      title: 'Other Pull Requests',
      subtitle: 'Not linked to any issue',
    },
  ];

  for (const section of standalonePrSections) {
    const prSection = buildStandaloneSection(
      section.items,
      (item, pos) => createPrNode(item as PullRequest, repoFullName, pos),
      PR_WIDTH,
      PR_CARD_HEIGHT,
      STANDALONE_PR_GAP_X,
      STANDALONE_PR_GAP_Y,
      section.id,
      section.title,
      section.subtitle,
      currentY
    );
    allNodes.push(...prSection.nodes);
    currentY = prSection.nextY;
  }

  return allNodes;
}
