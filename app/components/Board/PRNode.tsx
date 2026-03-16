'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { GitPullRequest, ExternalLink } from 'lucide-react';
import LabelBadge from '../LabelBadge';

export type PRNodeData = {
  github_number: number;
  title: string;
  state: string;
  author: string;
  author_avatar: string | null;
  labels: string[];
  additions: number;
  deletions: number;
  changed_files: number;
  draft: boolean;
  repo_full_name?: string;
};

function PRNodeComponent({ data, selected }: NodeProps & { data: PRNodeData }) {
  const nodeData = data as unknown as PRNodeData;
  const ghUrl = nodeData.repo_full_name
    ? `https://github.com/${nodeData.repo_full_name}/pull/${nodeData.github_number}`
    : '#';

  return (
    <div
      className={`w-80 bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 transition-shadow ${
        selected
          ? 'border-blue-500 shadow-blue-200/50 dark:shadow-blue-500/20'
          : nodeData.draft
            ? 'border-gray-300 dark:border-gray-600 hover:shadow-lg'
            : 'border-purple-400/60 dark:border-purple-500/40 hover:shadow-lg'
      }`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <GitPullRequest size={14} className={`shrink-0 ${nodeData.draft ? 'text-gray-400' : 'text-purple-500'}`} />
            <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
              #{nodeData.github_number}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                nodeData.draft
                  ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
              }`}
            >
              {nodeData.draft ? 'draft' : nodeData.state}
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
        <div className="flex items-center gap-2 text-xs font-mono mb-2">
          <span className="text-green-600 dark:text-green-400 font-semibold">+{nodeData.additions.toLocaleString()}</span>
          <span className="text-red-500 dark:text-red-400 font-semibold">-{nodeData.deletions.toLocaleString()}</span>
          {nodeData.changed_files > 0 && (
            <span className="text-gray-400 dark:text-gray-500">{nodeData.changed_files} files</span>
          )}
        </div>
        {nodeData.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {nodeData.labels.map((label) => (
              <LabelBadge key={label} label={label} />
            ))}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-purple-500 !border-2 !border-white dark:!border-gray-900" />
    </div>
  );
}

export default memo(PRNodeComponent);
