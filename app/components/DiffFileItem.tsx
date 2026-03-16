'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { fileStatusColor, fileStatusLabel } from '@/app/lib/diffUtils';
import type { PRFile } from '@/app/lib/types';

export default function DiffFileItem({ file }: { file: PRFile }) {
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
