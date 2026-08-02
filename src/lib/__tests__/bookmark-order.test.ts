import { describe, it, expect } from 'vitest';
import { applyOrderAndLabels, reorder, type BookmarkMeta, type OrderableBookmark } from '../bookmark-order';

describe('applyOrderAndLabels', () => {
  const bookmarks: OrderableBookmark[] = [
    { id: '1', title: 'GitHub', url: 'https://github.com' },
    { id: '2', title: 'Example', url: 'https://example.com' },
  ];

  it('sorts by stored order when meta exists for all bookmarks', () => {
    const meta: BookmarkMeta[] = [
      { bookmarkId: '1', order: 1, label: 'Github' },
      { bookmarkId: '2', order: 0, label: 'Example' },
    ];
    const result = applyOrderAndLabels(bookmarks, meta, () => 'fallback');
    expect(result.map((b) => b.id)).toEqual(['2', '1']);
  });

  it('applies the default label function when no meta exists', () => {
    const result = applyOrderAndLabels(bookmarks, [], (b) => `Label-${b.id}`);
    expect(result.map((b) => b.label)).toEqual(['Label-1', 'Label-2']);
  });

  it('appends bookmarks with no meta after existing ordered ones', () => {
    const meta: BookmarkMeta[] = [{ bookmarkId: '1', order: 5, label: 'Github' }];
    const result = applyOrderAndLabels(bookmarks, meta, () => 'fallback');
    expect(result[0]!.id).toBe('1');
    expect(result[1]!.id).toBe('2');
    expect(result[1]!.order).toBeGreaterThan(5);
  });
});

describe('reorder', () => {
  it('moves an item from one index to another', () => {
    expect(reorder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('is a no-op moving to the same index', () => {
    expect(reorder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('returns the original array unchanged for an out-of-range fromIndex', () => {
    expect(reorder(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});
