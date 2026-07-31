import { normalizeUrl } from './url-normalize';

export interface SearchSuggestion {
  kind: 'tab' | 'history';
  title: string;
  url: string;
  tabId?: number;
}

export interface SearchInputs {
  tabs: Array<{ id?: number; title?: string; url?: string }>;
  history: Array<{ title?: string; url?: string }>;
}

function matches(query: string, title: string, url: string): boolean {
  const q = query.toLowerCase();
  return title.toLowerCase().includes(q) || url.toLowerCase().includes(q);
}

/** Builds the instant-search suggestion list: matching open tabs first, then
 *  matching history entries, deduped against tabs already shown by normalized URL. */
export function buildSuggestions(query: string, inputs: SearchInputs): SearchSuggestion[] {
  if (!query.trim()) return [];

  const tabSuggestions: SearchSuggestion[] = inputs.tabs
    .filter((t) => t.title && t.url && matches(query, t.title, t.url))
    .map((t) => ({ kind: 'tab', title: t.title as string, url: t.url as string, tabId: t.id }));

  const shownUrls = new Set(tabSuggestions.map((s) => normalizeUrl(s.url)));

  const historySuggestions: SearchSuggestion[] = inputs.history
    .filter((h) => h.title && h.url && matches(query, h.title, h.url))
    .filter((h) => !shownUrls.has(normalizeUrl(h.url as string)))
    .map((h) => ({ kind: 'history', title: h.title as string, url: h.url as string }));

  return [...tabSuggestions, ...historySuggestions];
}

/** Arrow-key navigation index math: clamps/wraps within [0, length-1], or -1 for "no selection". */
export function moveSelection(current: number, direction: 'up' | 'down', length: number): number {
  if (length === 0) return -1;
  if (current === -1) return direction === 'down' ? 0 : length - 1;
  const next = direction === 'down' ? current + 1 : current - 1;
  return ((next % length) + length) % length;
}
