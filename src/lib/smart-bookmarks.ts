import type { AiProvider } from './ai-provider';
import { withSmartFallback, type SmartResult } from './smart-call';
import { labelForUrl } from './bookmark-labels';
import { keywordSearchBookmarks, type SearchableBookmark } from './bookmark-search';
import type { LocalStorage } from './storage-types';

const LABEL_SYSTEM_PROMPT = [
  'You assign a short topic label to each bookmark.',
  'Input is a numbered list: "<id>. <title> — <url>".',
  'Output STRICT JSON only, no prose, no code fences:',
  '{"labels":{"<id>":"Topic"}}',
  'Rules:',
  '- Label by subject matter (e.g. "Recipes", "Tax docs", "Machine learning"),',
  '  never by website name.',
  '- 1-2 words, title case. Reuse the same label for related bookmarks.',
  '- Only use ids from the input. Every id gets exactly one label.',
].join('\n');

const SEARCH_SYSTEM_PROMPT = [
  'You find bookmarks matching a natural-language description.',
  'Input is the query, then a numbered list: "<id>. <title> — <url>".',
  'Output STRICT JSON only, no prose, no code fences: {"ids":["<id>"]}',
  'Rules:',
  '- Return ids of bookmarks that genuinely match the intent of the query.',
  '- Order by how well they match, best first.',
  '- Only use ids from the input. Never invent ids.',
  '- Return an empty list if nothing matches.',
].join('\n');

interface LabelResponse {
  labels?: Record<string, unknown>;
}

interface SearchResponse {
  ids?: unknown;
}

function stripCodeFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
}

function formatBookmarksForPrompt(bookmarks: SearchableBookmark[]): string {
  return bookmarks.map((b) => `${b.id}. ${b.title} — ${b.url}`).join('\n');
}

/** Parses topic labels, keyed by bookmark id.
 *
 *  Ids not present in the input are dropped, and any bookmark the model
 *  skipped falls back to its hostname label — so the result always covers
 *  every bookmark, never fewer. */
export function parseSmartLabels(response: string, bookmarks: SearchableBookmark[]): Map<string, string> {
  let payload: LabelResponse;
  try {
    payload = JSON.parse(stripCodeFences(response)) as LabelResponse;
  } catch {
    throw new Error('Smart bookmark labelling returned malformed JSON.');
  }

  const raw = payload.labels;
  if (!raw || typeof raw !== 'object') throw new Error('Smart bookmark labelling returned no labels.');

  const byId = new Map<string, string>();
  let smartLabelCount = 0;

  for (const bookmark of bookmarks) {
    const value = (raw as Record<string, unknown>)[bookmark.id];
    const label = typeof value === 'string' ? value.trim() : '';
    if (label) smartLabelCount++;
    // Bookmarks the model skipped keep their hostname label, so the result
    // always covers every bookmark.
    byId.set(bookmark.id, label || labelForUrl(bookmark.url));
  }

  // Nothing usable came back — treat as a failure so the caller's note
  // explains why labels didn't improve, rather than silently showing
  // hostname labels as though they were smart ones.
  if (smartLabelCount === 0) throw new Error('Smart bookmark labelling produced no usable labels.');

  return byId;
}

/** §10.2 bookmark labels. Smart mode assigns real topic labels; simple mode
 *  labels by hostname. Same label field. */
export async function labelBookmarksSmart(
  storage: LocalStorage,
  provider: AiProvider,
  bookmarks: SearchableBookmark[],
): Promise<SmartResult<Map<string, string>>> {
  return withSmartFallback(
    storage,
    provider,
    { system: LABEL_SYSTEM_PROMPT, user: formatBookmarksForPrompt(bookmarks), maxTokens: 1024 },
    (response) => parseSmartLabels(response, bookmarks),
    () => new Map(bookmarks.map((b) => [b.id, labelForUrl(b.url)])),
  );
}

/** Parses matching ids and resolves them back to real bookmarks, preserving
 *  the model's relevance ordering. Unknown ids are dropped. */
export function parseSmartSearchResults<T extends SearchableBookmark>(response: string, bookmarks: T[]): T[] {
  let payload: SearchResponse;
  try {
    payload = JSON.parse(stripCodeFences(response)) as SearchResponse;
  } catch {
    throw new Error('Smart bookmark search returned malformed JSON.');
  }

  if (!Array.isArray(payload.ids)) throw new Error('Smart bookmark search returned no ids.');

  const byId = new Map(bookmarks.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const matches: T[] = [];

  for (const id of payload.ids) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    const bookmark = byId.get(id);
    if (!bookmark) continue;
    seen.add(id);
    matches.push(bookmark);
  }

  return matches;
}

/** §10.2 bookmark search. Smart mode resolves natural language; simple mode
 *  does keyword matching. Same search box.
 *
 *  An empty smart result is a legitimate "nothing matched" answer, not a
 *  failure — so it is returned as-is rather than falling back to keywords. */
export async function searchBookmarksSmart<T extends SearchableBookmark>(
  storage: LocalStorage,
  provider: AiProvider,
  query: string,
  bookmarks: T[],
): Promise<SmartResult<T[]>> {
  return withSmartFallback(
    storage,
    provider,
    {
      system: SEARCH_SYSTEM_PROMPT,
      user: `Query: ${query}\n\nBookmarks:\n${formatBookmarksForPrompt(bookmarks)}`,
      maxTokens: 512,
    },
    (response) => parseSmartSearchResults(response, bookmarks),
    () => keywordSearchBookmarks(query, bookmarks),
  );
}
