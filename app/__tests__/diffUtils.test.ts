import { describe, it, expect } from 'vitest';
import { fileStatusColor, fileStatusLabel } from '../lib/diffUtils';

describe('fileStatusColor', () => {
  it('returns green for added files', () => {
    expect(fileStatusColor('added')).toBe('text-green-500');
  });

  it('returns red for removed files', () => {
    expect(fileStatusColor('removed')).toBe('text-red-500');
  });

  it('returns blue for renamed files', () => {
    expect(fileStatusColor('renamed')).toBe('text-blue-500');
  });

  it('returns yellow for modified files', () => {
    expect(fileStatusColor('modified')).toBe('text-yellow-500');
  });

  it('returns yellow for unknown status', () => {
    expect(fileStatusColor('unknown')).toBe('text-yellow-500');
  });
});

describe('fileStatusLabel', () => {
  it('returns A for added', () => {
    expect(fileStatusLabel('added')).toBe('A');
  });

  it('returns D for removed', () => {
    expect(fileStatusLabel('removed')).toBe('D');
  });

  it('returns R for renamed', () => {
    expect(fileStatusLabel('renamed')).toBe('R');
  });

  it('returns M for modified', () => {
    expect(fileStatusLabel('modified')).toBe('M');
  });

  it('returns M for unknown status', () => {
    expect(fileStatusLabel('unknown')).toBe('M');
  });
});
