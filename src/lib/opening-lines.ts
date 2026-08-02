const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'NOSCRIPT']);
const MIN_BLOCK_LENGTH = 40;
const PREVIEW_MAX_LENGTH = 200;

/** Simple-mode read-later preview: first meaningful text block on the page.
 *  No AI — walks the body looking for the first <p> (or paragraph-like block)
 *  with enough real text, skipping nav/header/footer/script/style content. */
export function extractOpeningLines(doc: Document): string | null {
  const candidates = doc.body?.querySelectorAll('p, article p, main p') ?? [];

  for (const el of candidates) {
    if (isInsideSkippedAncestor(el)) continue;
    const text = el.textContent?.trim().replace(/\s+/g, ' ') ?? '';
    if (text.length >= MIN_BLOCK_LENGTH) {
      return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…` : text;
    }
  }

  return null;
}

function isInsideSkippedAncestor(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (SKIP_TAGS.has(node.tagName)) return true;
    node = node.parentElement;
  }
  return false;
}
