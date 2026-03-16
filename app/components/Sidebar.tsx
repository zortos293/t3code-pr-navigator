'use client';

import { GitFork, Star, CircleDot, GitPullRequest } from 'lucide-react';

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
};

export default function Sidebar({
  repos,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      {repos.length === 0 && (
        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <GitFork size={32} className="mx-auto mb-2 opacity-40" />
          <p>No demo repositories are available right now.</p>
          <p className="text-xs mt-1">Repository management is hidden in this public view.</p>
        </div>
      )}
      {repos.map((repo) => {
        return (
          <button
            type="button"
            key={repo.id}
            className={`w-full border-b border-gray-100 text-left transition-colors dark:border-gray-800 ${
              selectedId === repo.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-2 border-l-transparent'
            }`}
            onClick={() => onSelect(repo.id)}
          >
            <div className="p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <GitFork size={13} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{repo.owner}</span>
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate mt-0.5">{repo.name}</h3>
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
            </div>
          </button>
        );
      })}
    </div>
  );
}
