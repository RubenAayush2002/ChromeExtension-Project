const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'FORM', 'NOSCRIPT']);
const MIN_ARTICLE_TEXT_LENGTH = 200;

export interface ExtractedArticle {
  title: string;
  contentHtml: string;
  wordCount: number;
}

/**
 * Readability-style DOM heuristic: scores candidate containers (article,
 * main, or div/section) by text length minus link-heavy penalty, picks the
 * highest scorer. Returns null if nothing looks like a real article — the
 * reading view then shows a plain "can't parse this page" message instead
 * of rendering a broken or empty view.
 */
export function extractArticle(doc: Document): ExtractedArticle | null {
  const candidates = [...doc.querySelectorAll('article, main, div, section')];

  let best: { el: Element; score: number } | null = null;

  for (const el of candidates) {
    if (isInsideSkippedAncestor(el)) continue;
    const score = scoreElement(el);
    if (score > (best?.score ?? 0)) {
      best = { el, score };
    }
  }

  if (!best || textLength(best.el) < MIN_ARTICLE_TEXT_LENGTH) {
    return null;
  }

  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || 'Untitled';
  const text = best.el.textContent?.trim().replace(/\s+/g, ' ') ?? '';
  const wordCount = text.length > 0 ? text.split(/\s+/).length : 0;

  return {
    title,
    contentHtml: best.el.innerHTML,
    wordCount,
  };
}

function isInsideSkippedAncestor(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (SKIP_TAGS.has(node.tagName)) return true;
    node = node.parentElement;
  }
  return false;
}

function textLength(el: Element): number {
  return (el.textContent ?? '').trim().length;
}

function linkTextLength(el: Element): number {
  let total = 0;
  for (const a of el.querySelectorAll('a')) {
    total += (a.textContent ?? '').length;
  }
  return total;
}

function scoreElement(el: Element): number {
  const text = textLength(el);
  if (text === 0) return 0;
  const linkDensity = linkTextLength(el) / text;
  const paragraphCount = el.querySelectorAll('p').length;
  return text * (1 - linkDensity) + paragraphCount * 20;
}

const WORDS_PER_MINUTE = 200;

export function estimatedReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}
