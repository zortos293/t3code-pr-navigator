'use client';

import { useCallback, useMemo, useEffect, useState, memo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import type { Connection, Node, Edge, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import IssueNode from './IssueNode';
import type { IssueNodeData } from './IssueNode';
import PRNode from './PRNode';
import type { PRNodeData } from './PRNode';
import LaneHeaderNode from './LaneHeaderNode';
import type { LaneHeaderData } from './LaneHeaderNode';
import CustomEdge from './CustomEdge';
import DetailPanel from './DetailPanel';
import type { DetailItem } from './DetailPanel';
import type { Issue, PullRequest } from '@/app/lib/db';
import { RotateCcw } from 'lucide-react';

type Relationship = {
  id: number;
  issue_id: number;
  pr_id: number;
  relationship_type: string;
  confidence: number;
  issue_number: number;
  pr_number: number;
};

type Props = {
  issues: Issue[];
  pullRequests: PullRequest[];
  relationships: Relationship[];
  repoFullName: string;
  onCreateRelationship?: (issueId: number, prId: number) => void;
  onDeleteRelationship?: (id: number) => void;
};

type Cluster = {
  issues: Issue[];
  prs: PullRequest[];
};

/* ── Cluster group background node ──────────────────────────── */

type ClusterGroupData = { width: number; height: number };

function ClusterGroupComponent({ data }: NodeProps) {
  const d = data as unknown as ClusterGroupData;
  return (
    <div
      className="rounded-2xl border-2 border-dashed border-purple-200/50 dark:border-purple-700/30 bg-purple-50/20 dark:bg-purple-900/[0.06]"
      style={{ width: d.width, height: d.height, pointerEvents: 'none' }}
    />
  );
}
const ClusterGroup = memo(ClusterGroupComponent);

/* ── Node & edge types ──────────────────────────────────────── */

const nodeTypes = {
  issue: IssueNode,
  pr: PRNode,
  'lane-header': LaneHeaderNode,
  'cluster-group': ClusterGroup,
};

const edgeTypes = {
  custom: CustomEdge,
};

/* ── Layout constants ───────────────────────────────────────── */

const HEADER_X = 10;
const CONTENT_X = 20;
const ISSUE_WIDTH = 288;
const PR_WIDTH = 320;
const PAIR_GAP = 120;
const ISSUE_STACK_STEP = 150;
const PR_STACK_STEP = 150;
const CLUSTER_H_GAP = 80;
const CLUSTER_V_GAP = 40;
const SECTION_GAP = 60;
const HEADER_HEIGHT = 56;
const HEADER_CONTENT_GAP = 20;
const MAX_CLUSTERS_PER_ROW = 2;
const ISSUE_CARD_HEIGHT = 130;
const PR_CARD_HEIGHT = 140;
const GROUP_PADDING = 16;

// Full card layout for standalone items
const STANDALONE_ISSUE_GAP_X = 20;
const STANDALONE_ISSUE_GAP_Y = 16;
const STANDALONE_PR_GAP_X = 20;
const STANDALONE_PR_GAP_Y = 16;
const MAX_STANDALONE_PER_ROW = 6;

/* ── Helpers ────────────────────────────────────────────────── */

function parseLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    return JSON.parse(labelsJson);
  } catch {
    return [];
  }
}

function createIssueNode(issue: Issue, repoFullName: string, position: { x: number; y: number }): Node {
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

function createPrNode(pr: PullRequest, repoFullName: string, position: { x: number; y: number }): Node {
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

/* ── Union-Find clustering ──────────────────────────────────── */

function buildClusters(
  issues: Issue[],
  pullRequests: PullRequest[],
  relationships: Relationship[]
): { clusters: Cluster[]; standaloneIssues: Issue[]; standalonePrs: PullRequest[] } {
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

  // Sort clusters: larger first, then by first issue number
  clusters.sort((a, b) => {
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

/* ── Main layout builder ────────────────────────────────────── */

function buildClusteredNodes(
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

  /* ── Section: Connected Work ───────────────────────────────── */
  if (clusters.length > 0) {
    const connectedCount = clusters.reduce(
      (sum, c) => sum + c.issues.length + c.prs.length,
      0
    );

    // Track max X for header width
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

      // Wrap to new row
      if (clustersInRow >= MAX_CLUSTERS_PER_ROW && clustersInRow > 0) {
        rowStartY += rowMaxHeight + CLUSTER_V_GAP;
        clusterX = CONTENT_X;
        rowMaxHeight = 0;
        clustersInRow = 0;
      }

      // Group background node
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

      // Place issues (left column)
      cluster.issues.forEach((issue, idx) => {
        contentNodes.push(
          createIssueNode(issue, repoFullName, {
            x: clusterX,
            y: rowStartY + idx * ISSUE_STACK_STEP,
          })
        );
      });

      // Place PRs (right column)
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

    // Add header
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

  /* ── Section: Standalone Issues ────────────────────────────── */
  if (standaloneIssues.length > 0) {
    let maxContentX = CONTENT_X;
    const contentNodes: Node[] = [];
    const contentStartY = currentY + HEADER_HEIGHT + HEADER_CONTENT_GAP;

    let x = CONTENT_X;
    let rowY = contentStartY;
    let cardsInRow = 0;
    let rowMaxHeight = 0;

    for (const issue of standaloneIssues) {
      if (cardsInRow >= MAX_STANDALONE_PER_ROW && cardsInRow > 0) {
        rowY += rowMaxHeight + STANDALONE_ISSUE_GAP_Y;
        x = CONTENT_X;
        cardsInRow = 0;
        rowMaxHeight = 0;
      }
      contentNodes.push(createIssueNode(issue, repoFullName, { x, y: rowY }));
      maxContentX = Math.max(maxContentX, x + ISSUE_WIDTH);
      x += ISSUE_WIDTH + STANDALONE_ISSUE_GAP_X;
      rowMaxHeight = Math.max(rowMaxHeight, ISSUE_CARD_HEIGHT);
      cardsInRow++;
    }

    const headerWidth = Math.max(600, maxContentX - HEADER_X + 20);
    allNodes.push({
      id: 'lane-issues',
      type: 'lane-header',
      position: { x: HEADER_X, y: currentY },
      data: {
        title: 'Issues',
        subtitle: 'Not linked to any pull request',
        count: standaloneIssues.length,
        variant: 'other',
        width: headerWidth,
      } satisfies LaneHeaderData,
      draggable: false,
      selectable: false,
      connectable: false,
    });

    allNodes.push(...contentNodes);
    currentY = rowY + rowMaxHeight + SECTION_GAP;
  }

  /* ── Section: Standalone Pull Requests ─────────────────────── */
  if (standalonePrs.length > 0) {
    let maxContentX = CONTENT_X;
    const contentNodes: Node[] = [];
    const contentStartY = currentY + HEADER_HEIGHT + HEADER_CONTENT_GAP;

    let x = CONTENT_X;
    let rowY = contentStartY;
    let cardsInRow = 0;
    let rowMaxHeight = 0;

    for (const pr of standalonePrs) {
      if (cardsInRow >= MAX_STANDALONE_PER_ROW && cardsInRow > 0) {
        rowY += rowMaxHeight + STANDALONE_PR_GAP_Y;
        x = CONTENT_X;
        cardsInRow = 0;
        rowMaxHeight = 0;
      }
      contentNodes.push(createPrNode(pr, repoFullName, { x, y: rowY }));
      maxContentX = Math.max(maxContentX, x + PR_WIDTH);
      x += PR_WIDTH + STANDALONE_PR_GAP_X;
      rowMaxHeight = Math.max(rowMaxHeight, PR_CARD_HEIGHT);
      cardsInRow++;
    }

    const headerWidth = Math.max(600, maxContentX - HEADER_X + 20);
    allNodes.push({
      id: 'lane-prs',
      type: 'lane-header',
      position: { x: HEADER_X, y: currentY },
      data: {
        title: 'Pull Requests',
        subtitle: 'Not linked to any issue',
        count: standalonePrs.length,
        variant: 'other',
        width: headerWidth,
      } satisfies LaneHeaderData,
      draggable: false,
      selectable: false,
      connectable: false,
    });

    allNodes.push(...contentNodes);
  }

  return allNodes;
}

/* ── Board component ────────────────────────────────────────── */

export default function Board({
  issues,
  pullRequests,
  relationships,
  repoFullName,
  onCreateRelationship,
  onDeleteRelationship,
}: Props) {
  const [hasUserMoved, setHasUserMoved] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<DetailItem | null>(null);

  const initialNodes = useMemo(
    () => buildClusteredNodes(issues, pullRequests, relationships, repoFullName),
    [issues, pullRequests, relationships, repoFullName]
  );

  const initialEdges = useMemo(
    () =>
      relationships.map((rel) => ({
        id: `rel-${rel.id}`,
        source: `issue-${rel.issue_id}`,
        target: `pr-${rel.pr_id}`,
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
        data: {
          label: rel.relationship_type === 'solves' ? 'solved by' : rel.relationship_type,
          confidence: rel.confidence,
          relationshipId: rel.id,
        },
      })),
    [relationships]
  );

  // Focus fitView on connected work section if it exists
  const fitViewNodeIds = useMemo(() => {
    if (relationships.length === 0) return undefined;
    const ids: { id: string }[] = [{ id: 'lane-connected' }];
    const issueIds = new Set(relationships.map((r) => r.issue_id));
    const prIds = new Set(relationships.map((r) => r.pr_id));
    for (const id of issueIds) ids.push({ id: `issue-${id}` });
    for (const id of prIds) ids.push({ id: `pr-${id}` });
    return ids;
  }, [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setHasUserMoved(false);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const resetLayout = useCallback(() => {
    setNodes(initialNodes);
    setHasUserMoved(false);
  }, [initialNodes, setNodes]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'lane-header' || node.type === 'cluster-group') return;

      const issueMatch = node.id.match(/^issue-(\d+)$/);
      const prMatch = node.id.match(/^pr-(\d+)$/);

      if (issueMatch) {
        const issueId = parseInt(issueMatch[1]);
        const issue = issues.find((i) => i.id === issueId);
        if (issue) {
          setSelectedDetail((prev) =>
            prev?.type === 'issue' && prev.item.id === issueId
              ? null
              : { type: 'issue', item: issue }
          );
        }
      } else if (prMatch) {
        const prId = parseInt(prMatch[1]);
        const pr = pullRequests.find((p) => p.id === prId);
        if (pr) {
          setSelectedDetail((prev) =>
            prev?.type === 'pr' && prev.item.id === prId
              ? null
              : { type: 'pr', item: pr }
          );
        }
      }
    },
    [issues, pullRequests]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedDetail(null);
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target && onCreateRelationship) {
        const issueIdMatch = params.source.match(/^issue-(\d+)$/);
        const prIdMatch = params.target.match(/^pr-(\d+)$/);
        if (issueIdMatch && prIdMatch) {
          onCreateRelationship(parseInt(issueIdMatch[1]), parseInt(prIdMatch[1]));
        }
      }
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'custom',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
            data: { label: 'solved by', confidence: 1, relationshipId: 0 },
          },
          eds
        )
      );
    },
    [setEdges, onCreateRelationship]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (onDeleteRelationship) {
        for (const edge of deletedEdges) {
          const edgeData = edge.data as { relationshipId?: number } | undefined;
          if (edgeData?.relationshipId) {
            onDeleteRelationship(edgeData.relationshipId);
          }
        }
      }
    },
    [onDeleteRelationship]
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={() => setHasUserMoved(true)}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, nodes: fitViewNodeIds }}
        minZoom={0.05}
        maxZoom={2}
        deleteKeyCode="Delete"
        className="bg-gray-50 dark:bg-gray-950"
      >
        {hasUserMoved && (
          <Panel position="bottom-center">
            <button
              type="button"
              onClick={resetLayout}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/95 px-4 py-2.5 text-[13px] font-semibold text-gray-700 shadow-lg shadow-gray-900/10 backdrop-blur-sm transition-all hover:border-gray-300 hover:bg-white hover:shadow-xl active:scale-[0.97] dark:border-gray-700/80 dark:bg-gray-900/95 dark:text-gray-200 dark:shadow-black/30 dark:hover:border-gray-600 dark:hover:bg-gray-800"
            >
              <RotateCcw size={14} className="text-gray-500 dark:text-gray-400" />
              Reset to Default
            </button>
          </Panel>
        )}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />
        <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg !rounded-lg [&>button]:!bg-white dark:[&>button]:!bg-gray-800 [&>button]:!border-gray-200 dark:[&>button]:!border-gray-700 [&>button]:!text-gray-600 dark:[&>button]:!text-gray-400 [&>button:hover]:!bg-gray-50 dark:[&>button:hover]:!bg-gray-700" />
        <MiniMap
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg !rounded-lg"
          nodeColor={(node) => {
            if (node.type === 'issue') return '#22c55e';
            if (node.type === 'pr') return '#a855f7';
            if (node.type === 'lane-header') return 'transparent';
            if (node.type === 'cluster-group') return 'transparent';
            return '#6b7280';
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>

      <DetailPanel
        detail={selectedDetail}
        repoFullName={repoFullName}
        relationships={relationships}
        issues={issues}
        pullRequests={pullRequests}
        onClose={() => setSelectedDetail(null)}
        onNavigate={(detail) => setSelectedDetail(detail)}
      />
    </div>
  );
}
