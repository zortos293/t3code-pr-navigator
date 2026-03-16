import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, timeAgo } from '../lib/dateUtils';

describe('formatDate', () => {
  it('returns empty string for null input', () => {
    expect(formatDate(null)).toBe('');
  });

  it('formats a valid date string', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    expect(result).toMatch(/Jun 15, 2024/);
  });

  it('formats another date correctly', () => {
    const result = formatDate('2023-01-01T00:00:00Z');
    expect(result).toMatch(/Jan 1, 2023/);
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for very recent dates', () => {
    expect(timeAgo('2024-06-15T12:00:00Z')).toBe('just now');
  });

  it('returns minutes ago for dates within an hour', () => {
    expect(timeAgo('2024-06-15T11:45:00Z')).toBe('15m ago');
  });

  it('returns hours ago for dates within a day', () => {
    expect(timeAgo('2024-06-15T09:00:00Z')).toBe('3h ago');
  });

  it('returns days ago for dates within 30 days', () => {
    expect(timeAgo('2024-06-10T12:00:00Z')).toBe('5d ago');
  });

  it('returns formatted date for dates older than 30 days', () => {
    const result = timeAgo('2024-01-01T00:00:00Z');
    expect(result).toMatch(/Jan 1, 2024/);
  });
});
