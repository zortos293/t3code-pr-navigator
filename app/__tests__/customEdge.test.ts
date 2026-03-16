import { describe, expect, it } from 'vitest';
import { getEdgeLabel, getEdgeTooltip, shouldRenderEdgeLabel } from '../components/Board/CustomEdge';

describe('getEdgeLabel', () => {
  it('shows confidence for partial-confidence links', () => {
    expect(getEdgeLabel('solves', 0.84)).toBe('84%');
  });

  it('shows linked to for fully linked items', () => {
    expect(getEdgeLabel('solves', 1)).toBe('linked to');
  });

  it('keeps relates labels instead of renaming them to confidence', () => {
    expect(getEdgeLabel('relates', 1)).toBe('relates');
    expect(getEdgeLabel('relates', 0.88)).toBe('relates');
  });

  it('falls back when confidence is unavailable', () => {
    expect(getEdgeLabel(undefined, undefined, 'custom')).toBe('custom');
  });
});

describe('getEdgeTooltip', () => {
  it('explains relates edges', () => {
    expect(getEdgeTooltip('relates')).toContain('not confirmed to fully solve it');
  });

  it('does not show tooltips for solves edges', () => {
    expect(getEdgeTooltip('solves')).toBeNull();
  });
});

describe('shouldRenderEdgeLabel', () => {
  it('hides labels while dragging', () => {
    expect(shouldRenderEdgeLabel(true)).toBe(false);
  });

  it('shows labels when not dragging', () => {
    expect(shouldRenderEdgeLabel(false)).toBe(true);
  });
});
