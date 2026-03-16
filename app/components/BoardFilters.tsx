'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Filter, GitPullRequest, Link2, ShieldCheck, Tags, X } from 'lucide-react';
import {
  BOARD_VISIBILITY_MODES,
  PULL_REQUEST_SIZE_LABELS,
  type PullRequestFilters,
  type BoardVisibilityMode,
  type PullRequestSizeLabel,
  PULL_REQUEST_VOUCH_STATES,
  type PullRequestVouchState,
} from '@/app/lib/pullRequestFilters';

const SIZE_LABELS: Record<PullRequestSizeLabel, string> = {
  'size:xs': 'XS',
  'size:s': 'S',
  'size:m': 'M',
  'size:l': 'L',
  'size:xl': 'XL',
  'size:xxl': 'XXL',
};

const VOUCH_LABELS: Record<PullRequestVouchState, string> = {
  trusted: 'Trusted',
  unvouched: 'Unvouched',
  none: 'No vouch',
};

const VISIBILITY_LABELS: Record<BoardVisibilityMode, string> = {
  all: 'All cards',
  issues: 'Issues focus',
  prs: 'PR focus',
  links: 'Links only',
};

type Props = {
  filters: PullRequestFilters;
  sizeCounts: Record<PullRequestSizeLabel, number>;
  vouchCounts: Record<PullRequestVouchState, number>;
  visiblePullRequestCount: number;
  totalPullRequestCount: number;
  visibleIssueCount: number;
  totalIssueCount: number;
  visibleRelationshipCount: number;
  totalRelationshipCount: number;
  hasActiveFilters: boolean;
  onChange: (filters: PullRequestFilters) => void;
  onClear: () => void;
};

function toggleValue<T extends string>(values: T[], value: T): T[] {
  if (values.includes(value)) {
    return values.filter((entry) => entry !== value);
  }

  return [...values, value];
}

type FilterChipProps = {
  active: boolean;
  disabled: boolean;
  label: string;
  count?: number;
  onClick: () => void;
};

function FilterChip({ active, disabled, label, count, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold transition-colors ${
        active
          ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-900/20 dark:border-blue-400 dark:bg-blue-500 dark:text-slate-950'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {active && <Check size={12} />}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            active ? 'bg-white/20 text-white dark:bg-slate-950/15 dark:text-slate-950' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default function BoardFilters({
  filters,
  sizeCounts,
  vouchCounts,
  visiblePullRequestCount,
  totalPullRequestCount,
  visibleIssueCount,
  totalIssueCount,
  visibleRelationshipCount,
  totalRelationshipCount,
  hasActiveFilters,
  onChange,
  onClear,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const activeLabels = useMemo(() => {
    const visibilityLabel = filters.visibility !== 'all' ? [VISIBILITY_LABELS[filters.visibility]] : [];
    const vouchLabels = filters.vouchStates.map((state) => VOUCH_LABELS[state]);
    const sizeLabels = filters.sizes.map((size) => SIZE_LABELS[size]);
    return [...visibilityLabel, ...vouchLabels, ...sizeLabels];
  }, [filters.sizes, filters.visibility, filters.vouchStates]);

  return (
    <div ref={panelRef} className="relative">
      <div className="flex items-center gap-2">
        {activeLabels.slice(0, 2).map((label) => (
          <span
            key={label}
            className="hidden rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 lg:inline-flex dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
          >
            {label}
          </span>
        ))}
        {activeLabels.length > 2 && (
          <span className="hidden rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 lg:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            +{activeLabels.length - 2}
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
            hasActiveFilters
              ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-900/20 dark:border-blue-400 dark:bg-blue-500 dark:text-slate-950'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
          }`}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Filter size={14} />
          Filters
          {hasActiveFilters && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold dark:bg-slate-950/15">
              {activeLabels.length}
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full z-[1200] mt-2 w-[min(92vw,28rem)] overflow-hidden rounded-3xl border border-slate-200/80 bg-white/98 p-3 shadow-2xl shadow-slate-900/12 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/96 dark:shadow-black/35">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <Filter size={12} />
                Board filters
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Show only the PR sizes and trust levels you care about.
              </p>
            </div>
            <button
              type="button"
              onClick={onClear}
              disabled={!hasActiveFilters}
              className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${
                hasActiveFilters
                  ? 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900'
                  : 'cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600'
              }`}
            >
              <X size={12} />
              Clear
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                <GitPullRequest size={12} className="text-violet-500" />
                PRs
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {visiblePullRequestCount}/{totalPullRequestCount}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                <Tags size={12} className="text-emerald-500" />
                Issues
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {visibleIssueCount}/{totalIssueCount}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                <Link2 size={12} className="text-sky-500" />
                Links
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {visibleRelationshipCount}/{totalRelationshipCount}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/55">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                <Filter size={12} />
                Focus
              </div>
              <div className="flex flex-wrap gap-2">
                {BOARD_VISIBILITY_MODES.map((visibilityMode) => (
                  <FilterChip
                    key={visibilityMode}
                    active={filters.visibility === visibilityMode}
                    disabled={false}
                    label={VISIBILITY_LABELS[visibilityMode]}
                    onClick={() =>
                      onChange({
                        ...filters,
                        visibility: visibilityMode,
                      })
                    }
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/55">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                <ShieldCheck size={12} />
                Vouch
              </div>
              <div className="flex flex-wrap gap-2">
                {PULL_REQUEST_VOUCH_STATES.map((vouchState) => (
                  <FilterChip
                    key={vouchState}
                    active={filters.vouchStates.includes(vouchState)}
                    disabled={vouchCounts[vouchState] === 0}
                    label={VOUCH_LABELS[vouchState]}
                    count={vouchCounts[vouchState]}
                    onClick={() =>
                      onChange({
                        ...filters,
                        vouchStates: toggleValue(filters.vouchStates, vouchState),
                      })
                    }
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-900/55">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                <Tags size={12} />
                Size
              </div>
              <div className="flex flex-wrap gap-2">
                {PULL_REQUEST_SIZE_LABELS.map((sizeLabel) => (
                  <FilterChip
                    key={sizeLabel}
                    active={filters.sizes.includes(sizeLabel)}
                    disabled={sizeCounts[sizeLabel] === 0}
                    label={SIZE_LABELS[sizeLabel]}
                    count={sizeCounts[sizeLabel]}
                    onClick={() =>
                      onChange({
                        ...filters,
                        sizes: toggleValue(filters.sizes, sizeLabel),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
