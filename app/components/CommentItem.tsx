'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { timeAgo } from '@/app/lib/dateUtils';
import type { Comment } from '@/app/lib/types';
import MarkdownContent from './MarkdownContent';

type Props = {
  comment: Comment;
  defaultExpanded: boolean;
};

export default function CommentItem({ comment, defaultExpanded }: Props) {
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
