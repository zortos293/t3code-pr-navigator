'use client';

import { GitFork, Star, CircleDot, GitPullRequest, Trash2, RefreshCw, Loader2, Sparkles } from 'lucide-react';

export type RepoSummary = {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  open_issues_count: number;
  open_prs_count: number;
};

type Props = {
  repos: RepoSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onSync: (id: number) => void;
  onAnalyze: (id: number) => void;
  syncingId: number | null;
  analyzingId: number | null;
  analysisProgress: Record<number, { progress: number; status: string }>;
};

export default function Sidebar({
  repos,
  selectedId,
  onSelect,
  onDelete,
  onSync,
  onAnalyze,
  syncingId,
  analyzingId,
  analysisProgress,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      {repos.length === 0 && (
        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <GitFork size={32} className="mx-auto mb-2 opacity-40" />
          <p>No repositories added yet.</p>
          <p className="text-xs mt-1">Enter a GitHub URL above to get started.</p>
        </div>
      )}
      {repos.map((repo) => {
        const progressState = analysisProgress[repo.id];
        const isAnalyzing = analyzingId === repo.id || progressState?.status === 'running';
        const showProgress = Boolean(progressState) && (isAnalyzing || progressState?.status === 'failed');
        const progress = progressState ? Math.min(100, Math.max(0, progressState.progress)) : 0;
        const isFailed = progressState?.status === 'failed';
        const visibleProgress = progressState?.status === 'running' && progress === 0 ? 2 : progress;
        const progressBarClass = isFailed ? 'bg-red-500' : 'bg-green-500';
        const progressTrackClass = 'bg-gray-200 dark:bg-gray-700/80';

        return (
          <div
            key={repo.id}
            className={`group border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
              selectedId === repo.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-2 border-l-transparent'
            }`}
            onClick={() => onSelect(repo.id)}
          >
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <GitFork size={13} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{repo.owner}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate mt-0.5">{repo.name}</h3>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSync(repo.id); }}
                    disabled={syncingId === repo.id}
                    className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                    title="Sync"
                  >
                    {syncingId === repo.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAnalyze(repo.id); }}
                    disabled={isAnalyzing}
                    className="p-1 text-gray-400 hover:text-purple-500 rounded transition-colors"
                    title="AI Analysis"
                  >
                    {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(repo.id); }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {repo.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{repo.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Star size={11} className="text-yellow-500" />
                  {repo.stars.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <CircleDot size={11} className="text-green-500" />
                  {repo.open_issues_count}
                </span>
                <span className="flex items-center gap-1">
                  <GitPullRequest size={11} className="text-purple-500" />
                  {repo.open_prs_count}
                </span>
              </div>
              {showProgress && (
                <div className="mt-2 flex items-center gap-2">
                  <div className={`h-[3px] flex-1 overflow-hidden rounded-full ${progressTrackClass}`}>
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ease-out ${progressBarClass}`}
                      style={{ width: `${visibleProgress}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${isFailed ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {progress}%
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
