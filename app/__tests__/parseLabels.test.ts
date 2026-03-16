import { describe, it, expect } from 'vitest';
import { parseLabels } from '../lib/parseLabels';

describe('parseLabels', () => {
  it('returns empty array for null input', () => {
    expect(parseLabels(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseLabels('')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseLabels('not json')).toEqual([]);
  });

  it('parses valid JSON array of labels', () => {
    expect(parseLabels('["bug","feature","docs"]')).toEqual(['bug', 'feature', 'docs']);
  });

  it('parses empty JSON array', () => {
    expect(parseLabels('[]')).toEqual([]);
  });

  it('handles single-element array', () => {
    expect(parseLabels('["enhancement"]')).toEqual(['enhancement']);
  });

  it('parses legacy JSON arrays of label objects', () => {
    expect(parseLabels('[{"name":"bug"},{"name":"enhancement"}]')).toEqual(['bug', 'enhancement']);
  });
});
