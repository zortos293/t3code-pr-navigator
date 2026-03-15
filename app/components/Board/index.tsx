'use client';

import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import type { Connection, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import IssueNode from './IssueNode';
import type { IssueNodeData } from './IssueNode';
import PRNode from './PRNode';
import type { PRNodeData } from './PRNode';
import CustomEdge from './CustomEdge';
import type { Issue, PullRequest } from '@/app/lib/db';

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

const nodeTypes = {
  issue: IssueNode,
  pr: PRNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

function parseLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    return JSON.parse(labelsJson);
  } catch {
    return [];
  }
}

export default function Board({
  issues,
  pullRequests,
  relationships,
  repoFullName,
  onCreateRelationship,
  onDeleteRelationship,
}: Props) {
  const initialNodes = useMemo(() => {
    const issueNodes: Node[] = issues.map((issue, i) => ({
      id: `issue-${issue.id}`,
      type: 'issue',
      position: { x: 50, y: i * 180 },
      data: {
        github_number: issue.github_number,
        title: issue.title,
        state: issue.state,
        author: issue.author,
        author_avatar: issue.author_avatar,
        labels: parseLabels(issue.labels),
        repo_full_name: repoFullName,
      } satisfies IssueNodeData,
    }));

    const prNodes: Node[] = pullRequests.map((pr, i) => ({
      id: `pr-${pr.id}`,
      type: 'pr',
      position: { x: 600, y: i * 200 },
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
    }));

    return [...issueNodes, ...prNodes];
  }, [issues, pullRequests, repoFullName]);

  const initialEdges = useMemo(() => {
    return relationships.map((rel) => ({
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
    }));
  }, [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

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
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode="Delete"
        className="bg-gray-50 dark:bg-gray-950"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />
        <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg !rounded-lg [&>button]:!bg-white dark:[&>button]:!bg-gray-800 [&>button]:!border-gray-200 dark:[&>button]:!border-gray-700 [&>button]:!text-gray-600 dark:[&>button]:!text-gray-400 [&>button:hover]:!bg-gray-50 dark:[&>button:hover]:!bg-gray-700" />
        <MiniMap
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg !rounded-lg"
          nodeColor={(node) => {
            if (node.type === 'issue') return '#22c55e';
            if (node.type === 'pr') return '#a855f7';
            return '#6b7280';
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}
