import type { Node } from '@xyflow/react';
import type { Issue, PullRequest } from './db';
import type { Relationship } from './types';
import type { IssueNodeData } from '../components/Board/IssueNode';
import type { PRNodeData } from '../components/Board/PRNode';
import type { LaneHeaderData } from '../components/Board/LaneHeaderNode';
import { buildClusters } from './clustering';
import { parseLabels } from './parseLabels';
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
    id: `lane-${sectionTitle.toLowerCase().replace(/\s+/g, '-')}`,
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
      const issueCount = cluster.issues.length;
      const prCount = cluster.prs.length;
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

      cluster.issues.forEach((issue, idx) => {
        contentNodes.push(
          createIssueNode(issue, repoFullName, {
            x: clusterX,
            y: rowStartY + idx * ISSUE_STACK_STEP,
          })
        );
      });

      cluster.prs.forEach((pr, idx) => {
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

  /* ── Section: Standalone Issues ──────────────────────────── */
  const issueSection = buildStandaloneSection(
    standaloneIssues,
    (item, pos) => createIssueNode(item as Issue, repoFullName, pos),
    ISSUE_WIDTH,
    ISSUE_CARD_HEIGHT,
    STANDALONE_ISSUE_GAP_X,
    STANDALONE_ISSUE_GAP_Y,
    'Issues',
    'Not linked to any pull request',
    currentY
  );
  allNodes.push(...issueSection.nodes);
  currentY = issueSection.nextY;

  /* ── Section: Standalone Pull Requests ───────────────────── */
  const prSection = buildStandaloneSection(
    standalonePrs,
    (item, pos) => createPrNode(item as PullRequest, repoFullName, pos),
    PR_WIDTH,
    PR_CARD_HEIGHT,
    STANDALONE_PR_GAP_X,
    STANDALONE_PR_GAP_Y,
    'Pull Requests',
    'Not linked to any issue',
    currentY
  );
  allNodes.push(...prSection.nodes);

  return allNodes;
}
