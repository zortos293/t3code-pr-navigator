'use client';

import { CircleDot, GitPullRequest } from 'lucide-react';
import type { SyncToastData } from '@/app/hooks/useSyncProgress';

type Props = SyncToastData;

export default function SyncToast({ repoName, type, current, total, number, dismissing = false }: Props) {
  const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const Icon = type === 'pr' ? GitPullRequest : CircleDot;
  const accentClass = type === 'pr'
    ? 'border-l-purple-500 text-purple-400'
    : 'border-l-green-500 text-green-400';
  const label = type === 'pr' ? 'PR' : 'Issue';

  return (
    <div
      className={[
        'w-80 rounded-lg border border-gray-800 border-l-4 bg-gray-900/95 px-4 py-3 shadow-2xl backdrop-blur-sm transition-all duration-300 ease-out',
        accentClass,
        dismissing ? 'translate-x-6 opacity-0' : 'translate-x-0 opacity-100',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-100">
            Fetching {label} #{number}
          </p>
          <p className="truncate text-xs text-gray-400">
            {repoName}
          </p>
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className={[
                  'h-full rounded-full transition-all duration-300',
                  type === 'pr' ? 'bg-purple-500' : 'bg-green-500',
                ].join(' ')}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-gray-400">
              <span>{progress}% complete</span>
              <span>{Math.min(current, total)}/{total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
