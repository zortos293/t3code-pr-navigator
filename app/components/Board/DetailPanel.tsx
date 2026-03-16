'use client';

import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  X,
  CircleDot,
  GitPullRequest,
  MessageSquare,
  Calendar,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  FileCode,
  Link2,
} from 'lucide-react';
import LabelBadge from '../LabelBadge';
import type { Issue, PullRequest } from '@/app/lib/db';

type Comment = {
  id: number;
  body: string;
  author: string;
  author_avatar: string | null;
  created_at: string;
  updated_at: string;
};

type PRFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
};

type Relationship = {
  id: number;
  issue_id: number;
  pr_id: number;
  relationship_type: string;
  confidence: number;
  issue_number: number;
  pr_number: number;
};

export type DetailItem =
  | { type: 'issue'; item: Issue }
  | { type: 'pr'; item: PullRequest };

type Props = {
  detail: DetailItem | null;
  repoFullName: string;
  relationships: Relationship[];
  issues: Issue[];
  pullRequests: PullRequest[];
  onClose: () => void;
  onNavigate: (detail: DetailItem) => void;
};

function parseLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    return JSON.parse(labelsJson);
  } catch {
    return [];
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) return formatDate(dateStr);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

function fileStatusColor(status: string): string {
  switch (status) {
    case 'added': return 'text-green-500';
    case 'removed': return 'text-red-500';
    case 'renamed': return 'text-blue-500';
    default: return 'text-yellow-500';
  }
}

function fileStatusLabel(status: string): string {
  switch (status) {
    case 'added': return 'A';
    case 'removed': return 'D';
    case 'renamed': return 'R';
    default: return 'M';
  }
}

/* ── Markdown wrapper ──────────────────────────────────────── */

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        img: ({ src, alt, ...props }) => (
          <img
            src={src}
            alt={alt || ''}
            className="max-w-full rounded-lg my-2"
            loading="lazy"
            {...props}
          />
        ),
        a: ({ href, children, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 underline"
            {...props}
          >
            {children}
          </a>
        ),
        code: ({ children, className, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className={`${className} block bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-xs font-mono overflow-x-auto`} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto my-2">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-gray-300 dark:border-gray-600 pl-3 my-2 text-gray-500 dark:text-gray-400 italic">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
        p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border border-gray-200 dark:border-gray-700 rounded">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-gray-50 dark:bg-gray-800 px-2 py-1 border border-gray-200 dark:border-gray-700 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 border border-gray-200 dark:border-gray-700">
            {children}
          </td>
        ),
        hr: () => <hr className="my-3 border-gray-200 dark:border-gray-700" />,
        input: ({ checked, ...props }) => (
          <input type="checkbox" checked={checked} readOnly className="mr-1.5 rounded" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ── Collapsible Comment ───────────────────────────────────── */

function CommentItem({ comment, defaultExpanded }: { comment: Comment; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const previewText = comment.body.slice(0, 80).replace(/\n/g, ' ');

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-gray-400 shrink-0" />
        )}
        {comment.author_avatar ? (
          <img src={comment.author_avatar} alt={comment.author} className="w-4 h-4 rounded-full shrink-0" />
        ) : (
          <div className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
        )}
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {comment.author}
        </span>
        <span className="text-[10px] text-gray-400 shrink-0">
          {timeAgo(comment.created_at)}
        </span>
        {!expanded && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-1">
            {previewText}{comment.body.length > 80 ? '…' : ''}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed border-t border-gray-200 dark:border-gray-700">
          <MarkdownContent content={comment.body} />
        </div>
      )}
    </div>
  );
}

/* ── Diff File Item ────────────────────────────────────────── */

function DiffFileItem({ file }: { file: PRFile }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        {file.patch ? (
          expanded ? (
            <ChevronDown size={12} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-gray-400 shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className={`text-[10px] font-mono font-bold ${fileStatusColor(file.status)} shrink-0`}>
          {fileStatusLabel(file.status)}
        </span>
        <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
          {file.filename}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono shrink-0">
          <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
          <span className="text-red-500 dark:text-red-400">-{file.deletions}</span>
        </span>
      </button>
      {expanded && file.patch && (
        <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
          <pre className="text-[11px] font-mono leading-[1.6] p-0 m-0">
            {file.patch.split('\n').map((line, i) => {
              let bgClass = '';
              let textClass = 'text-gray-600 dark:text-gray-400';
              if (line.startsWith('+') && !line.startsWith('+++')) {
                bgClass = 'bg-green-50 dark:bg-green-900/20';
                textClass = 'text-green-800 dark:text-green-300';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                bgClass = 'bg-red-50 dark:bg-red-900/20';
                textClass = 'text-red-800 dark:text-red-300';
              } else if (line.startsWith('@@')) {
                bgClass = 'bg-blue-50 dark:bg-blue-900/20';
                textClass = 'text-blue-600 dark:text-blue-400';
              }
              return (
                <div key={i} className={`px-3 ${bgClass} ${textClass}`}>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Main DetailPanel ──────────────────────────────────────── */

export default function DetailPanel({
  detail,
  repoFullName,
  relationships,
  issues,
  pullRequests,
  onClose,
  onNavigate,
}: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [prFiles, setPrFiles] = useState<PRFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    if (!detail) {
      setComments([]);
      setPrFiles([]);
      return;
    }

    const [owner, name] = repoFullName.split('/');
    const number = detail.item.github_number;

    setLoadingComments(true);
    setComments([]);

    fetch(`/api/comments?owner=${owner}&name=${name}&number=${number}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setComments(data);
      })
      .catch(() => {})
      .finally(() => setLoadingComments(false));

    // Fetch PR files if it's a PR
    if (detail.type === 'pr') {
      setLoadingFiles(true);
      setPrFiles([]);
      fetch(`/api/pr-files?owner=${owner}&name=${name}&number=${number}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setPrFiles(data);
        })
        .catch(() => {})
        .finally(() => setLoadingFiles(false));
    } else {
      setPrFiles([]);
    }
  }, [detail, repoFullName]);

  // Find linked items
  const linkedItems = useMemo(() => {
    if (!detail) return [];
    const result: DetailItem[] = [];

    if (detail.type === 'issue') {
      const issueId = detail.item.id;
      const linkedPrIds = relationships
        .filter((r) => r.issue_id === issueId)
        .map((r) => r.pr_id);
      for (const prId of linkedPrIds) {
        const pr = pullRequests.find((p) => p.id === prId);
        if (pr) result.push({ type: 'pr', item: pr });
      }
    } else {
      const prId = detail.item.id;
      const linkedIssueIds = relationships
        .filter((r) => r.pr_id === prId)
        .map((r) => r.issue_id);
      for (const issueId of linkedIssueIds) {
        const issue = issues.find((i) => i.id === issueId);
        if (issue) result.push({ type: 'issue', item: issue });
      }
    }

    return result;
  }, [detail, relationships, issues, pullRequests]);

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
