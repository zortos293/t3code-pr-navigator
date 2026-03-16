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
import PRNode from './PRNode';
import LaneHeaderNode from './LaneHeaderNode';
import CustomEdge from './CustomEdge';
import DetailPanel from './DetailPanel';
import type { Issue, PullRequest } from '@/app/lib/db';
import type { Relationship, DetailItem } from '@/app/lib/types';
import { buildClusteredNodes } from '@/app/lib/boardLayout';
import { RotateCcw } from 'lucide-react';

type Props = {
  issues: Issue[];
  pullRequests: PullRequest[];
  relationships: Relationship[];
  repoFullName: string;
  onCreateRelationship?: (issueId: number, prId: number) => void;
  onDeleteRelationship?: (id: number) => void;
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
