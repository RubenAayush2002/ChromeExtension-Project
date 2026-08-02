export interface BookmarkMeta {
  bookmarkId: string;
  order: number;
  label: string;
}

export interface BookmarkMetaRepo {
  all(): Promise<BookmarkMeta[]>;
  put(meta: BookmarkMeta): Promise<void>;
  delete(bookmarkId: string): Promise<void>;
}

export interface OrderableBookmark {
  id: string;
  title: string;
  url: string;
}

export interface OrderedBookmark extends OrderableBookmark {
  order: number;
  label: string;
}

/** Merges the real chrome.bookmarks list with the locally-tracked order/label
 *  index, sorted by that order. Bookmarks with no stored meta yet (newly
 *  created, or synced from another device) get appended at the end in their
 *  natural chrome.bookmarks order and a default label via `defaultLabel`. */
export function applyOrderAndLabels(
  bookmarks: OrderableBookmark[],
  metaList: BookmarkMeta[],
  defaultLabel: (bookmark: OrderableBookmark) => string,
): OrderedBookmark[] {
  const metaById = new Map(metaList.map((m) => [m.bookmarkId, m]));
  let nextOrder = metaList.length > 0 ? Math.max(...metaList.map((m) => m.order)) + 1 : 0;

  const merged = bookmarks.map((b) => {
    const meta = metaById.get(b.id);
    if (meta) return { ...b, order: meta.order, label: meta.label };
    return { ...b, order: nextOrder++, label: defaultLabel(b) };
  });

  return merged.sort((a, b) => a.order - b.order);
}

/** Computes new order values after a drag-to-reorder move within the same
 *  folder's bookmark list. Returns the full set of {bookmarkId, order} pairs
 *  to persist. */
export function reorder(ids: string[], fromIndex: number, toIndex: number): string[] {
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return ids;
  next.splice(toIndex, 0, moved);
  return next;
}
