'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { GitPullRequest, CircleDot, ArrowRight, Loader2, LayoutDashboard } from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';
import RepoForm from './components/RepoForm';
import Sidebar from './components/Sidebar';
import Board from './components/Board';
import BoardFilters from './components/BoardFilters';
import ToastContainer from './components/Toast/ToastContainer';
import { useRepos } from './hooks/useRepos';
import { useBoard } from './hooks/useBoard';
import { useSyncProgress } from './hooks/useSyncProgress';
import {
  createEmptyPullRequestFilters,
  filterBoardByPullRequestFilters,
  getPullRequestFilterCounts,
  hasActivePullRequestFilters,
} from './lib/pullRequestFilters';

export default function Home() {
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [pullRequestFilters, setPullRequestFilters] = useState(createEmptyPullRequestFilters);

  const syncProgress = useSyncProgress();
  const { repos, analysisProgress, addRepo, deleteRepo, syncRepo, analyzeRepo, refresh: refreshRepos } = useRepos(syncProgress);
  const board = useBoard(selectedRepoId);

  useEffect(() => {
    setPullRequestFilters(createEmptyPullRequestFilters());
  }, [selectedRepoId]);

  const filteredBoard = useMemo(
    () =>
      filterBoardByPullRequestFilters(
        {
          issues: board.issues,
          pullRequests: board.pullRequests,
          relationships: board.relationships,
        },
        pullRequestFilters
      ),
    [board.issues, board.pullRequests, board.relationships, pullRequestFilters]
  );
  const pullRequestFilterCounts = useMemo(
    () => getPullRequestFilterCounts(board.pullRequests),
    [board.pullRequests]
  );
  const hasActiveFilters = hasActivePullRequestFilters(pullRequestFilters);
  const hasBoardData = board.issues.length > 0 || board.pullRequests.length > 0;
  const hasVisibleBoardData = filteredBoard.issues.length > 0 || filteredBoard.pullRequests.length > 0;

  const handleAdd = useCallback(async (url: string) => {
    const repo = await addRepo(url);
    if (repo?.id) setSelectedRepoId(repo.id);
  }, [addRepo]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteRepo(id);
    if (selectedRepoId === id) setSelectedRepoId(null);
  }, [deleteRepo, selectedRepoId]);

  const handleSync = useCallback(async (id: number) => {
    setSyncingId(id);
    try {
      await syncRepo(id);
      if (selectedRepoId === id) {
        await board.refresh();
      }
    } finally {
      setSyncingId(null);
    }
  }, [syncRepo, selectedRepoId, board]);

  const handleAnalyze = useCallback(async (id: number) => {
    setAnalyzingId(id);
    try {
      await analyzeRepo(id);
      if (selectedRepoId === id) board.refresh();
      await refreshRepos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'OpenCode analysis failed');
    } finally {
      setAnalyzingId(null);
    }
  }, [analyzeRepo, selectedRepoId, board, refreshRepos]);

  return (
    <div className="h-screen flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-blue-600 dark:text-blue-400" />
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">PR Navigator</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {selectedRepoId && !board.loading && (
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <CircleDot size={12} className="text-green-500" />
                {filteredBoard.issues.length} issues
              </span>
              <span className="flex items-center gap-1">
                <GitPullRequest size={12} className="text-purple-500" />
                {filteredBoard.pullRequests.length} PRs
              </span>
              {filteredBoard.relationships.length > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowRight size={12} className="text-purple-400" />
                  {filteredBoard.relationships.length} links
                </span>
              )}
            </div>
          )}
          {selectedRepoId && !board.loading && hasBoardData && (
            <BoardFilters
              filters={pullRequestFilters}
              sizeCounts={pullRequestFilterCounts.sizes}
              vouchCounts={pullRequestFilterCounts.vouchStates}
              visiblePullRequestCount={filteredBoard.pullRequests.length}
              totalPullRequestCount={board.pullRequests.length}
              visibleIssueCount={filteredBoard.issues.length}
              totalIssueCount={board.issues.length}
              visibleRelationshipCount={filteredBoard.relationships.length}
              totalRelationshipCount={board.relationships.length}
              hasActiveFilters={hasActiveFilters}
              onChange={setPullRequestFilters}
              onClear={() => setPullRequestFilters(createEmptyPullRequestFilters())}
            />
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-72 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0">
          <RepoForm onAdd={handleAdd} />
          <Sidebar
            repos={repos}
            selectedId={selectedRepoId}
            onSelect={setSelectedRepoId}
            onDelete={handleDelete}
            onSync={handleSync}
            onAnalyze={handleAnalyze}
            syncingId={syncingId}
            analyzingId={analyzingId}
            analysisProgress={analysisProgress}
          />
        </aside>

        <main className="flex-1 min-w-0 relative">
          {!selectedRepoId ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <LayoutDashboard size={28} className="text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Welcome to PR Navigator
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Add a GitHub repository to visualize issues and pull requests on an interactive board.
                  Drag to connect issues with PRs that solve them.
                </p>
                <div className="flex items-center justify-center gap-6 text-xs text-gray-400 dark:text-gray-500">
                  <div className="flex items-center gap-1">
                    <CircleDot size={12} className="text-green-500" />
                    Issues
                  </div>
                  <ArrowRight size={14} className="text-purple-400" />
                  <div className="flex items-center gap-1">
                    <GitPullRequest size={12} className="text-purple-500" />
                    Pull Requests
                  </div>
                </div>
              </div>
            </div>
          ) : board.loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading board data...</p>
              </div>
            </div>
          ) : !hasBoardData ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No open issues or pull requests found for this repository.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1">
                {hasVisibleBoardData ? (
                  <Board
                    issues={filteredBoard.issues}
                    pullRequests={filteredBoard.pullRequests}
                    relationships={filteredBoard.relationships}
                    repoFullName={board.repoFullName}
                    onCreateRelationship={board.createRelationship}
                    onDeleteRelationship={board.deleteRelationship}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6">
                    <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-white/85 px-8 py-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        No PRs match these filters
                      </h2>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Try a different size or trust combination, or clear the active filters to bring every card back.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <ToastContainer toasts={syncProgress.toasts} />
    </div>
  );
}
