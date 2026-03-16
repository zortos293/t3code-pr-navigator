'use client';

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Link2, ShieldCheck, ShieldAlert, Layers } from 'lucide-react';

export type LaneHeaderData = {
  title: string;
  subtitle: string;
  count: number;
  variant: 'linked' | 'verified' | 'unverified' | 'other';
  width?: number;
};

const variants = {
  linked: {
    Icon: Link2,
    accent: 'border-l-purple-500 dark:border-l-purple-400',
    bg: 'bg-purple-500/[0.06] dark:bg-purple-400/[0.06]',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    titleColor: 'text-purple-800 dark:text-purple-300',
    countBg: 'bg-purple-100/80 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  },
  verified: {
    Icon: ShieldCheck,
    accent: 'border-l-emerald-500 dark:border-l-emerald-400',
    bg: 'bg-emerald-500/[0.06] dark:bg-emerald-400/[0.06]',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    titleColor: 'text-emerald-800 dark:text-emerald-300',
    countBg: 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  unverified: {
    Icon: ShieldAlert,
    accent: 'border-l-amber-500 dark:border-l-amber-400',
    bg: 'bg-amber-500/[0.06] dark:bg-amber-400/[0.06]',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    titleColor: 'text-amber-800 dark:text-amber-300',
    countBg: 'bg-amber-100/80 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  other: {
    Icon: Layers,
    accent: 'border-l-slate-400 dark:border-l-slate-500',
    bg: 'bg-slate-500/[0.04] dark:bg-slate-400/[0.04]',
    iconBg: 'bg-slate-100 dark:bg-slate-800/60',
    iconColor: 'text-slate-500 dark:text-slate-400',
    titleColor: 'text-slate-700 dark:text-slate-300',
    countBg: 'bg-slate-100/80 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
  },
};

function LaneHeaderNodeComponent({ data }: NodeProps & { data: LaneHeaderData }) {
  const nodeData = data as unknown as LaneHeaderData;
  const v = variants[nodeData.variant] ?? variants.other;
  const { Icon } = v;

  return (
    <div className="pointer-events-none select-none" style={{ width: nodeData.width ?? 860 }}>
      <div
        className={`flex items-center gap-3.5 px-5 py-3.5 rounded-xl border-l-[3px] ${v.accent} ${v.bg} backdrop-blur-sm`}
      >
        <div
          className={`flex items-center justify-center w-7 h-7 rounded-lg ${v.iconBg}`}
        >
          <Icon size={15} className={v.iconColor} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`text-[11px] font-extrabold tracking-[0.18em] uppercase leading-none ${v.titleColor}`}
          >
            {nodeData.title}
          </h3>
          {nodeData.subtitle && (
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              {nodeData.subtitle}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold tabular-nums ${v.countBg}`}
        >
          {nodeData.count}
        </span>
      </div>
    </div>
  );
}

export default memo(LaneHeaderNodeComponent);
