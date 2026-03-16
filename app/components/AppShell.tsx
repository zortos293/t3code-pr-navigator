'use client';

import { useCallback, useState } from 'react';
import { GitPullRequest, CircleDot, ArrowRight, Loader2, LayoutDashboard } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import RepoForm from './RepoForm';
import Sidebar from './Sidebar';
import Board from './Board';
import ToastContainer from './Toast/ToastContainer';
import LogoutButton from './LogoutButton';
import { useRepos } from '../hooks/useRepos';
import { useBoard } from '../hooks/useBoard';
import { useSyncProgress } from '../hooks/useSyncProgress';

export default function AppShell() {
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);

  const syncProgress = useSyncProgress();
  const { repos, analysisProgress, addRepo, deleteRepo, syncRepo, analyzeRepo, refresh: refreshRepos } = useRepos(syncProgress);
  const board = useBoard(selectedRepoId);

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
  }, [board, selectedRepoId, syncRepo]);

  const handleAnalyze = useCallback(async (id: number) => {
    setAnalyzingId(id);
    try {
      await analyzeRepo(id);
      if (selectedRepoId === id) {
        await board.refresh();
      }
      await refreshRepos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzingId(null);
    }
  }, [analyzeRepo, board, refreshRepos, selectedRepoId]);

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-blue-600 dark:text-blue-400" />
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">PR Navigator</h1>
        </div>
        <div className="flex items-center gap-3">
          {selectedRepoId && !board.loading && (
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <CircleDot size={12} className="text-green-500" />
                {board.issues.length} issues
              </span>
              <span className="flex items-center gap-1">
                <GitPullRequest size={12} className="text-purple-500" />
                {board.pullRequests.length} PRs
              </span>
              {board.relationships.length > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowRight size={12} className="text-purple-400" />
                  {board.relationships.length} links
                </span>
              )}
            </div>
          )}
          <ThemeToggle />
          <LogoutButton />
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
          ) : board.issues.length === 0 && board.pullRequests.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No open issues or pull requests found for this repository.
                </p>
              </div>
            </div>
          ) : (
            <Board
              issues={board.issues}
              pullRequests={board.pullRequests}
              relationships={board.relationships}
              repoFullName={board.repoFullName}
              onCreateRelationship={board.createRelationship}
              onDeleteRelationship={board.deleteRelationship}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={syncProgress.toasts} />
    </div>
  );
}
