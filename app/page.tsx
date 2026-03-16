'use client';

import { useState, useCallback, useDeferredValue, useEffect, useMemo, useRef } from 'react';
import { GitPullRequest, CircleDot, ArrowRight, Loader2, LayoutDashboard, Search } from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';
import RepoForm from './components/RepoForm';
import Sidebar from './components/Sidebar';
import Board from './components/Board';
import type { BoardFocusRequest } from './components/Board';
import ToastContainer from './components/Toast/ToastContainer';
import { useRepos } from './hooks/useRepos';
import { useBoard } from './hooks/useBoard';
import { useSyncProgress } from './hooks/useSyncProgress';
import { searchBoardItems } from './lib/search';
import type { SearchResult } from './lib/search';

export default function Home() {
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<BoardFocusRequest | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const syncProgress = useSyncProgress();
  const { repos, analysisProgress, addRepo, deleteRepo, syncRepo, analyzeRepo, refresh: refreshRepos } = useRepos(syncProgress);
  const board = useBoard(selectedRepoId);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const searchResults = useMemo(
    () => searchBoardItems(deferredSearchQuery, board.issues, board.pullRequests).slice(0, 8),
    [deferredSearchQuery, board.issues, board.pullRequests]
  );

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
      alert(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzingId(null);
    }
  }, [analyzeRepo, selectedRepoId, board, refreshRepos]);

  useEffect(() => {
    setSearchQuery('');
    setIsSearchOpen(false);
    setFocusRequest(null);
  }, [selectedRepoId]);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    setSearchQuery(`#${result.githubNumber} ${result.title}`);
    setIsSearchOpen(false);
    setFocusRequest({
      nodeId: result.nodeId,
      detail: result.detail,
      nonce: Date.now(),
    });
  }, []);

  const handleSearchSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchResults.length > 0) {
      handleSearchSelect(searchResults[0]);
    }
  }, [handleSearchSelect, searchResults]);

  const handleSearchBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (!searchContainerRef.current?.contains(document.activeElement)) {
        setIsSearchOpen(false);
      }
    });
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <LayoutDashboard size={20} className="text-blue-600 dark:text-blue-400" />
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">PR Navigator</h1>
        </div>

        {selectedRepoId && !board.loading && (
          <div
            ref={searchContainerRef}
            onBlur={handleSearchBlur}
            className="relative flex-1 max-w-2xl"
          >
            <form onSubmit={handleSearchSubmit}>
              <label className="sr-only" htmlFor="board-search">
                Search issues and pull requests
              </label>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <input
                  id="board-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Search issues and PRs by number, title, label, or author"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-500 dark:focus:bg-gray-900 dark:focus:ring-blue-900/40"
                />
              </div>
            </form>

            {isSearchOpen && searchQuery.trim() && (
              <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-xl shadow-gray-900/10 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 dark:shadow-black/30">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    No matching issues or pull requests.
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto p-2">
                    {searchResults.map((result) => (
                      <button
                        key={result.key}
                        type="button"
                        onClick={() => handleSearchSelect(result)}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <span
                          className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${
                            result.kind === 'issue'
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                              : 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
                          }`}
                        >
                          {result.kind === 'issue' ? (
                            <CircleDot size={14} />
                          ) : (
                            <GitPullRequest size={14} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                            <span>{result.kind === 'issue' ? 'Issue' : 'Pull Request'}</span>
                            <span className="font-mono tracking-normal">#{result.githubNumber}</span>
                          </span>
                          <span className="mt-1 block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {result.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                            {result.subtitle}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
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
              focusRequest={focusRequest}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={syncProgress.toasts} />
    </div>
  );
}
