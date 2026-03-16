'use client';

import {
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  GitPullRequest,
  GitMerge,
  History,
  RefreshCw,
  Repeat2,
  XCircle,
} from 'lucide-react';
import type { ActivityEvent } from '@/app/lib/types';
import { timeAgo } from '@/app/lib/dateUtils';

type SyncSummary = {
  addedIssues: number;
  reopenedIssues: number;
  closedIssues: number;
  addedPullRequests: number;
  reopenedPullRequests: number;
  mergedPullRequests: number;
  closedPullRequests: number;
  openIssues: number;
  openPullRequests: number;
  trackedPullRequests: number;
};

type Props = {
  events: ActivityEvent[];
  repoFullName: string;
};

function parseSyncSummary(details: string | null): SyncSummary | null {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(details) as SyncSummary;
  } catch {
    return null;
  }
}

function buildEventUrl(repoFullName: string, event: ActivityEvent): string {
  if (event.entity_type === 'issue' && event.entity_number) {
    return `https://github.com/${repoFullName}/issues/${event.entity_number}`;
  }

  if (event.entity_type === 'pr' && event.entity_number) {
    return `https://github.com/${repoFullName}/pull/${event.entity_number}`;
  }

  return `https://github.com/${repoFullName}/pulls`;
}

function getEventMeta(event: ActivityEvent) {
  if (event.entity_type === 'sync') {
    return {
      icon: RefreshCw,
      badge: 'Sync',
      badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
      iconClass: 'text-sky-500 dark:text-sky-300',
    };
  }

  if (event.entity_type === 'issue') {
    if (event.action === 'closed') {
      return {
        icon: XCircle,
        badge: 'Issue Closed',
        badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        iconClass: 'text-rose-500 dark:text-rose-300',
      };
    }

    if (event.action === 'reopened') {
      return {
        icon: Repeat2,
        badge: 'Issue Reopened',
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        iconClass: 'text-amber-500 dark:text-amber-300',
      };
    }

    return {
      icon: CircleDot,
      badge: 'New Issue',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      iconClass: 'text-emerald-500 dark:text-emerald-300',
    };
  }

  if (event.action === 'merged') {
    return {
      icon: GitMerge,
      badge: 'PR Merged',
      badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
      iconClass: 'text-violet-500 dark:text-violet-300',
    };
  }

  if (event.action === 'closed') {
    return {
      icon: XCircle,
      badge: 'PR Closed',
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      iconClass: 'text-rose-500 dark:text-rose-300',
    };
  }

  if (event.action === 'reopened') {
    return {
      icon: Repeat2,
      badge: 'PR Reopened',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      iconClass: 'text-amber-500 dark:text-amber-300',
    };
  }

  return {
    icon: GitPullRequest,
    badge: 'New PR',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
    iconClass: 'text-fuchsia-500 dark:text-fuchsia-300',
  };
}

function SummaryChips({ summary }: { summary: SyncSummary }) {
  const chips = [
    { label: 'Open Issues', value: summary.openIssues },
    { label: 'Open PRs', value: summary.openPullRequests },
    { label: 'Tracked PRs', value: summary.trackedPullRequests },
    { label: 'New Issues', value: summary.addedIssues },
    { label: 'New PRs', value: summary.addedPullRequests },
    { label: 'Merged PRs', value: summary.mergedPullRequests },
  ].filter((chip) => chip.value > 0);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="rounded-full border border-gray-200/80 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-gray-600 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/70 dark:text-gray-300"
        >
          {chip.label}: {chip.value}
        </span>
      ))}
    </div>
  );
}

export default function ActivityList({ events, repoFullName }: Props) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_36%),linear-gradient(180deg,rgba(3,7,18,0.98),rgba(2,6,23,0.92))]">
      <div className="border-b border-gray-200/80 px-4 py-4 dark:border-gray-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-sky-200/80 bg-white/80 shadow-sm dark:border-sky-900/60 dark:bg-slate-900/70">
            <History size={16} className="text-sky-600 dark:text-sky-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              What changed on each sync, instead of guessing from the board.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {events.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300/80 bg-white/60 px-5 py-8 text-center dark:border-gray-700/80 dark:bg-gray-900/40">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No sync activity yet.</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Run sync and new issues, PRs, merges, and closures will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const meta = getEventMeta(event);
              const Icon = meta.icon;
              const summary = event.entity_type === 'sync' ? parseSyncSummary(event.details) : null;

              return (
                <article
                  key={event.id}
                  className="rounded-3xl border border-gray-200/80 bg-white/80 p-4 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-gray-800/80 dark:bg-slate-950/65 dark:shadow-black/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200/80 bg-gray-50 dark:border-gray-700/80 dark:bg-gray-900/80">
                      <Icon size={16} className={meta.iconClass} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${meta.badgeClass}`}>
                          {meta.badge}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {timeAgo(event.created_at)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {event.entity_number ? `#${event.entity_number} ` : ''}
                            {event.title || (event.entity_type === 'sync' ? 'Repository sync' : 'Untitled')}
                          </p>
                          {summary && <SummaryChips summary={summary} />}
                        </div>

                        <a
                          href={buildEventUrl(repoFullName, event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200/80 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-gray-700/80 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-white"
                        >
                          View
                          <ArrowUpRight size={12} />
                        </a>
                      </div>

                      {!summary && event.action === 'completed' && (
                        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-300" />
                          Sync completed with no tracked changes.
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
