'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { CircleDot, GitPullRequest } from 'lucide-react';

export type CompactNodeData = {
  nodeType: 'issue' | 'pr';
  github_number: number;
  title: string;
  state: string;
  author: string;
  draft?: boolean;
  repo_full_name?: string;
};

function CompactNodeComponent({ data, selected }: NodeProps & { data: CompactNodeData }) {
  const d = data as unknown as CompactNodeData;
  const isIssue = d.nodeType === 'issue';

  return (
    <div
      className={`w-[280px] h-9 flex items-center gap-2 px-2.5 rounded-lg border bg-white dark:bg-gray-900 text-xs transition-shadow cursor-pointer ${
        selected
          ? 'border-blue-500 shadow-blue-200/50 dark:shadow-blue-500/20 shadow-md'
          : isIssue
            ? 'border-green-300/60 dark:border-green-600/30 hover:shadow-md hover:border-green-400/80'
            : d.draft
              ? 'border-gray-300/60 dark:border-gray-600/30 hover:shadow-md'
              : 'border-purple-300/60 dark:border-purple-600/30 hover:shadow-md hover:border-purple-400/80'
      }`}
    >
      {isIssue ? (
        <CircleDot size={12} className="text-green-500 shrink-0" />
      ) : (
        <GitPullRequest size={12} className={d.draft ? 'text-gray-400 shrink-0' : 'text-purple-500 shrink-0'} />
      )}
      <span className="font-mono font-bold text-gray-400 dark:text-gray-500 shrink-0">
        #{d.github_number}
      </span>
      <span className="truncate flex-1 text-gray-700 dark:text-gray-300 font-medium">
        {d.title}
      </span>
      {isIssue ? (
        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-green-500 !border-2 !border-white dark:!border-gray-900" />
      ) : (
        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-purple-500 !border-2 !border-white dark:!border-gray-900" />
      )}
    </div>
  );
}

export default memo(CompactNodeComponent);
