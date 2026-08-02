import { describe, it, expect } from 'vitest';
import { findDuplicateTabIds } from '../duplicate-tabs';

describe('findDuplicateTabIds', () => {
  it('keeps the first tab and flags later duplicates by normalized url', () => {
    const ids = findDuplicateTabIds([
      { id: 1, url: 'https://example.com/article' },
      { id: 2, url: 'https://example.com/article?utm_source=twitter' },
      { id: 3, url: 'https://example.com/other' },
    ]);
    expect(ids).toEqual([2]);
  });

  it('returns an empty array when there are no duplicates', () => {
    const ids = findDuplicateTabIds([
      { id: 1, url: 'https://example.com/a' },
      { id: 2, url: 'https://example.com/b' },
    ]);
    expect(ids).toEqual([]);
  });

  it('handles trailing-slash variants as duplicates', () => {
    const ids = findDuplicateTabIds([
      { id: 1, url: 'https://example.com/page' },
      { id: 2, url: 'https://example.com/page/' },
    ]);
    expect(ids).toEqual([2]);
  });

  it('flags all but the first among 3+ duplicates', () => {
    const ids = findDuplicateTabIds([
      { id: 1, url: 'https://example.com/x' },
      { id: 2, url: 'https://example.com/x?fbclid=abc' },
      { id: 3, url: 'https://example.com/x?gclid=xyz' },
    ]);
    expect(ids).toEqual([2, 3]);
  });
});
