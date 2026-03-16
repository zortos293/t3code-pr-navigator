'use client';

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

type EdgeLabelData = {
  relationshipType?: string;
  label?: string;
  confidence?: number;
  labelSlot?: number;
  hideLabel?: boolean;
};

function normalizeRelationshipType(relationshipType?: string, fallbackLabel?: string): string {
  return (relationshipType || fallbackLabel || 'solves').trim().toLowerCase();
}

export function getEdgeLabel(
  relationshipType?: string,
  confidence?: number,
  fallbackLabel?: string
): string {
  const normalizedRelationshipType = normalizeRelationshipType(relationshipType, fallbackLabel);

  if (confidence === undefined) {
    return normalizedRelationshipType === 'solves' ? 'confidence' : normalizedRelationshipType;
  }

  const confidencePercent = Math.round(confidence * 100);

  if (normalizedRelationshipType === 'relates') {
    return 'relates';
  }

  if (confidencePercent >= 100) {
    return normalizedRelationshipType === 'solves' ? 'linked to' : normalizedRelationshipType;
  }

  return `${confidencePercent}%`;
}

export function getEdgeTooltip(
  relationshipType?: string,
  fallbackLabel?: string
): string | null {
  const normalizedRelationshipType = normalizeRelationshipType(relationshipType, fallbackLabel);

  if (normalizedRelationshipType === 'relates') {
    return 'Relates means this pull request is connected to the issue, but it is not confirmed to fully solve it.';
  }

  if (normalizedRelationshipType === 'supersedes') {
    return 'Supersedes means this pull request explicitly replaces or takes over the linked issue work.';
  }

  return null;
}

export function getEdgeLabelOffset(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  labelSlot = 0
): { x: number; y: number } {
  const verticalBias = Math.round((targetY - sourceY) * 0.12);
  const horizontalBias = targetX >= sourceX ? -10 : 10;
  return {
    x: horizontalBias + labelSlot * 14,
    y: Math.max(-72, Math.min(72, verticalBias + labelSlot * 28)),
  };
}

export function shouldRenderEdgeLabel(hideLabel?: boolean): boolean {
  return !hideLabel;
}

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as EdgeLabelData | undefined;
  const label = getEdgeLabel(edgeData?.relationshipType, edgeData?.confidence, edgeData?.label);
  const tooltip = getEdgeTooltip(edgeData?.relationshipType, edgeData?.label);
  const showLabel = shouldRenderEdgeLabel(edgeData?.hideLabel);
  const labelOffset = getEdgeLabelOffset(
    sourceX,
    sourceY,
    targetX,
    targetY,
    edgeData?.labelSlot
  );
  const labelPosition = {
    x: sourceX + (targetX - sourceX) * 0.5 + labelOffset.x,
    y: sourceY + (targetY - sourceY) * 0.46 + labelOffset.y,
  };
  const isRelates = normalizeRelationshipType(edgeData?.relationshipType, edgeData?.label) === 'relates';
  const isSupersedes = normalizeRelationshipType(edgeData?.relationshipType, edgeData?.label) === 'supersedes';
  const confidencePercent = edgeData?.confidence !== undefined ? Math.round(edgeData.confidence * 100) : null;
  const isContextLabel = isRelates || isSupersedes;
  const isConfidenceLabel = !isContextLabel && confidencePercent !== null && confidencePercent < 100;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: 2,
          stroke: '#8b5cf6',
          ...style,
        }}
        id={id}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelPosition.x}px,${labelPosition.y}px)`,
              pointerEvents: 'all',
              zIndex: 1200,
            }}
            className="group relative z-[1200] nodrag nopan"
          >
            {tooltip && (
              <div className="pointer-events-none absolute left-1/2 top-0 z-[1300] hidden w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-violet-400/35 bg-[#120b1d] px-3 py-2 text-[11px] font-medium leading-relaxed text-gray-100 group-hover:block">
                {tooltip}
                <div className="absolute left-1/2 top-full z-[1300] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-violet-400/35 bg-[#120b1d]" />
              </div>
            )}
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold whitespace-nowrap ${
                isContextLabel
                  ? isSupersedes
                    ? 'cursor-help border-amber-400/45 bg-[#211304] text-amber-100'
                    : 'cursor-help border-fuchsia-400/45 bg-[#1a0f2d] text-fuchsia-100'
                  : 'min-w-[82px] justify-center border-violet-400/45 bg-[#160d27] text-violet-100'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isContextLabel ? (isSupersedes ? 'bg-amber-300' : 'bg-fuchsia-300') : 'bg-violet-300'
                }`}
              />
              {isConfidenceLabel ? (
                <span className="rounded-full bg-violet-500/18 px-2 py-0.5 text-[11px] text-white">
                  {label}
                </span>
              ) : (
                <span>{label}</span>
              )}
              {isContextLabel && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-fuchsia-300/30 text-[9px] text-fuchsia-100/90">
                  ?
                </span>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(CustomEdgeComponent);
