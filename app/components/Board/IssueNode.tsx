'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { CircleDot, ExternalLink } from 'lucide-react';
import LabelBadge from '../LabelBadge';

export type IssueNodeData = {
  github_number: number;
  title: string;
  state: string;
  author: string;
  author_avatar: string | null;
  labels: string[];
  repo_full_name?: string;
};

function IssueNodeComponent({ data, selected }: NodeProps & { data: IssueNodeData }) {
  const nodeData = data as unknown as IssueNodeData;
  const ghUrl = nodeData.repo_full_name
    ? `https://github.com/${nodeData.repo_full_name}/issues/${nodeData.github_number}`
    : '#';

  return (
    <div
      className={`w-72 bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 transition-shadow ${
        selected
          ? 'border-blue-500 shadow-blue-200/50 dark:shadow-blue-500/20'
          : 'border-green-400/60 dark:border-green-500/40 hover:shadow-lg'
      }`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <CircleDot size={14} className="text-green-500 shrink-0" />
            <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
              #{nodeData.github_number}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
              {nodeData.state}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            {nodeData.author_avatar ? (
              <img
                src={nodeData.author_avatar}
                alt={nodeData.author}
                className="w-4 h-4 rounded-full shrink-0"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{nodeData.author}</span>
          </div>
          <a
            href={ghUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-500 transition-colors shrink-0 ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        </div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 mb-2">
          {nodeData.title}
        </h4>
        {nodeData.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {nodeData.labels.map((label) => (
              <LabelBadge key={label} label={label} />
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-green-500 !border-2 !border-white dark:!border-gray-900" />
    </div>
  );
}

export default memo(IssueNodeComponent);
