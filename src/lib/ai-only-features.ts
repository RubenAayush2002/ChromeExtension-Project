import type { AiProvider } from './ai-provider';
import { runAiOnly, type AiOnlyResult } from './smart-call';
import type { LocalStorage } from './storage-types';

/** §10.3 features have no simple-mode equivalent, so they never fall back —
 *  they either answer, tell the user to turn the layer on, or say plainly that
 *  the call failed. All three paths come from runAiOnly. */

const EXPLAIN_SYSTEM = [
  'You explain confusing text in plain language.',
  'Rules:',
  '- 1-2 sentences. No preamble, no "this text means".',
  '- Explain what it actually says, in everyday words.',
  '- Keep any technical term the reader clearly needs, but define it.',
].join('\n');

const EXPLAIN_SIMPLER_SYSTEM = [
  'You re-explain something even more simply, for someone who found the first',
  'explanation too complex.',
  'Rules:',
  '- 1-2 short sentences. Everyday words only. No jargon at all.',
  '- Use a concrete comparison if it helps.',
].join('\n');

const WORD_SYSTEM = [
  'You give a one-line plain-English meaning of a single word.',
  'Rules:',
  '- One short line. No part of speech, no pronunciation, no examples.',
  '- Define it as used in the sentence provided, if one is given.',
].join('\n');

const ASK_TABS_SYSTEM = [
  'You answer a question using the content of the browser tabs provided.',
  'Input is the question, then tabs as "[<n>] <title> — <url>\\n<excerpt>".',
  'Rules:',
  '- Answer from the tab content only. Never use outside knowledge.',
  '- Cite the tabs you used by their number, like [1] or [2][3].',
  '- If the tabs do not contain the answer, say so plainly and cite nothing.',
  '- Keep it under 120 words.',
].join('\n');

/** Maximum characters of page text sent per tab, keeping requests small
 *  enough to stay fast with many tabs open. */
const EXCERPT_CHARS = 1500;

export function explainText(
  storage: LocalStorage,
  provider: AiProvider,
  selection: string,
): Promise<AiOnlyResult> {
  return runAiOnly(storage, provider, { system: EXPLAIN_SYSTEM, user: selection, maxTokens: 200 });
}

/** The "explain even more simply" follow-up. Takes the original selection and
 *  the explanation the user found too complex, so the retry has context. */
export function explainTextSimpler(
  storage: LocalStorage,
  provider: AiProvider,
  selection: string,
  previousExplanation: string,
): Promise<AiOnlyResult> {
  return runAiOnly(storage, provider, {
    system: EXPLAIN_SIMPLER_SYSTEM,
    user: `Original text:\n${selection}\n\nExplanation that was too complex:\n${previousExplanation}`,
    maxTokens: 200,
  });
}

export interface WordLookupEntry {
  word: string;
  meaning: string;
  cachedAt: number;
}

export interface WordLookupCache {
  get(word: string): Promise<WordLookupEntry | null>;
  put(entry: WordLookupEntry): Promise<void>;
}

/** Normalizes a word for cache lookups so "The", "the," and "the" share one
 *  entry. Strips surrounding punctuation but keeps internal hyphens. */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/** §10.3 hold-key word lookup. Cached locally so repeat lookups are instant
 *  and don't re-call the API — the cache is checked before the layer's
 *  enabled state, so previously looked-up words still resolve offline. */
export async function lookupWord(
  storage: LocalStorage,
  provider: AiProvider,
  cache: WordLookupCache,
  word: string,
  sentence: string,
  now: number = Date.now(),
): Promise<AiOnlyResult> {
  const normalized = normalizeWord(word);
  if (!normalized) return { ok: false, reason: 'failed', message: 'No word to look up.' };

  const cached = await cache.get(normalized);
  if (cached) return { ok: true, value: cached.meaning };

  const result = await runAiOnly(storage, provider, {
    system: WORD_SYSTEM,
    user: sentence ? `Word: ${normalized}\nSentence: ${sentence}` : `Word: ${normalized}`,
    maxTokens: 60,
  });

  if (result.ok) {
    await cache.put({ word: normalized, meaning: result.value, cachedAt: now });
  }
  return result;
}

export interface TabContent {
  title: string;
  url: string;
  text: string;
}

function formatTabsForPrompt(tabs: TabContent[]): string {
  return tabs
    .map((tab, i) => `[${i + 1}] ${tab.title} — ${tab.url}\n${tab.text.slice(0, EXCERPT_CHARS)}`)
    .join('\n\n');
}

/** §10.3 ask-across-open-tabs. The answer cites source tabs by number; the
 *  caller maps those back to real tabs for display. */
export async function askAcrossTabs(
  storage: LocalStorage,
  provider: AiProvider,
  question: string,
  tabs: TabContent[],
): Promise<AiOnlyResult> {
  if (tabs.length === 0) {
    return { ok: false, reason: 'failed', message: 'No open tabs to read.' };
  }

  return runAiOnly(storage, provider, {
    system: ASK_TABS_SYSTEM,
    user: `Question: ${question}\n\nTabs:\n${formatTabsForPrompt(tabs)}`,
    maxTokens: 512,
  });
}

/** Extracts the 1-based tab numbers an answer cited, so the UI can show which
 *  tabs it came from. Numbers outside the provided range are ignored. */
export function parseCitedTabs(answer: string, tabCount: number): number[] {
  const cited = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= tabCount) cited.add(n);
  }
  return [...cited].sort((a, b) => a - b);
}
