import { extractOpeningLines } from '@/lib/opening-lines';
import { extractArticle } from '@/lib/reading-extract';

export interface PageExtractResult {
  openingLines: string | null;
  article: ReturnType<typeof extractArticle>;
}

declare global {
  interface Window {
    __zeroDriftExtractResult?: PageExtractResult;
  }
}

/**
 * Injected via chrome.scripting.executeScript({ files: ['content/page-extract.js'] })
 * against the active tab for Read Later and Reading View (§7.6, §7.7). Stashes
 * the result on `window` — executeScript's return value can't be trusted to
 * survive bundling as a bare completion expression, so the caller reads this
 * back with a second, tiny executeScript({ func: () => window.__zeroDriftExtractResult }).
 */
window.__zeroDriftExtractResult = {
  openingLines: extractOpeningLines(document),
  article: extractArticle(document),
};
