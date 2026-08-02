export interface SearchableBookmark {
  id: string;
  title: string;
  url: string;
  label?: string;
}

/** Simple-mode keyword search: plain case-insensitive match against title/URL/label. */
export function keywordSearchBookmarks<T extends SearchableBookmark>(query: string, bookmarks: T[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return bookmarks;

  return bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      (b.label?.toLowerCase().includes(q) ?? false),
  );
}
