'use client';

import {
  X,
  CircleDot,
  GitPullRequest,
  MessageSquare,
  Calendar,
  Loader2,
  ExternalLink,
  FileCode,
  Link2,
} from 'lucide-react';
import LabelBadge from '../LabelBadge';
import MarkdownContent from '../MarkdownContent';
import CommentItem from '../CommentItem';
import DiffFileItem from '../DiffFileItem';
import type { Issue, PullRequest } from '@/app/lib/db';
import type { Relationship, DetailItem } from '@/app/lib/types';
import { parseLabels } from '@/app/lib/parseLabels';
import { formatDate } from '@/app/lib/dateUtils';
import { useDetailContent } from '@/app/hooks/useDetailContent';

type Props = {
  detail: DetailItem | null;
  repoFullName: string;
  relationships: Relationship[];
  issues: Issue[];
  pullRequests: PullRequest[];
  onClose: () => void;
  onNavigate: (detail: DetailItem) => void;
};

export default function DetailPanel({
  detail,
  repoFullName,
  relationships,
  issues,
  pullRequests,
  onClose,
  onNavigate,
}: Props) {
  const { comments, loadingComments, prFiles, loadingFiles, linkedItems } =
    useDetailContent(detail, repoFullName, relationships, issues, pullRequests);

  if (!detail) return null;

  const { type, item } = detail;
  const labels = parseLabels(item.labels);
  const isIssue = type === 'issue';
  const ghUrl = isIssue
    ? `https://github.com/${repoFullName}/issues/${item.github_number}`
    : `https://github.com/${repoFullName}/pull/${item.github_number}`;

  const pr = type === 'pr' ? (item as PullRequest) : null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[480px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isIssue ? (
            <CircleDot size={16} className="text-green-500 shrink-0" />
          ) : (
            <GitPullRequest size={16} className="text-purple-500 shrink-0" />
          )}
          <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
            #{item.github_number}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
              isIssue
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : pr?.draft
                  ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            }`}
          >
            {pr?.draft ? 'draft' : item.state}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={ghUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-blue-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ExternalLink size={14} />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Title */}
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-3">
            {item.title}
          </h2>

          {/* Author & Date */}
          <div className="flex items-center gap-2 mb-3">
            {item.author_avatar ? (
              <img src={item.author_avatar} alt={item.author} className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600" />
            )}
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {item.author}
            </span>
            {item.created_at && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <Calendar size={10} />
                {formatDate(item.created_at)}
              </span>
            )}
          </div>

          {/* PR Stats */}
          {pr && (
            <div className="flex items-center gap-3 mb-3 text-xs font-mono">
              <span className="text-green-600 dark:text-green-400 font-semibold">
                +{pr.additions.toLocaleString()}
              </span>
              <span className="text-red-500 dark:text-red-400 font-semibold">
                -{pr.deletions.toLocaleString()}
              </span>
              {pr.changed_files > 0 && (
                <span className="text-gray-400 dark:text-gray-500">
                  {pr.changed_files} files changed
                </span>
              )}
            </div>
          )}

          {/* Labels */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {labels.map((label) => (
                <LabelBadge key={label} label={label} />
              ))}
            </div>
          )}

          {/* Linked Items */}
          {linkedItems.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Link2 size={12} />
                {isIssue ? 'Linked Pull Requests' : 'Linked Issues'}
              </h3>
              <div className="space-y-1.5">
                {linkedItems.map((linked) => (
                  <button
                    key={`${linked.type}-${linked.item.id}`}
                    onClick={() => onNavigate(linked)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    {linked.type === 'issue' ? (
                      <CircleDot size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <GitPullRequest size={14} className="text-purple-500 shrink-0" />
                    )}
                    <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
                      #{linked.item.github_number}
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {linked.item.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Body/Description */}
          {item.body ? (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Description
              </h3>
              <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 break-words leading-relaxed max-h-[400px] overflow-y-auto border border-gray-100 dark:border-gray-700/50">
                <MarkdownContent content={item.body} />
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                No description provided.
              </p>
            </div>
          )}

          {/* PR Changed Files / Diff */}
          {pr && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileCode size={12} />
                Changed Files
                {!loadingFiles && prFiles.length > 0 && (
                  <span className="text-gray-400">({prFiles.length})</span>
                )}
              </h3>

              {loadingFiles ? (
                <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  Loading files...
                </div>
              ) : prFiles.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">
                  No files changed.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {prFiles.map((file) => (
                    <DiffFileItem key={file.filename} file={file} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare size={12} />
              Comments
              {!loadingComments && (
                <span className="text-gray-400">({comments.length})</span>
              )}
            </h3>

            {loadingComments ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                Loading comments...
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">
                No comments yet.
              </p>
            ) : (
              <div className="space-y-2">
                {comments.map((comment, idx) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    defaultExpanded={idx === 0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
