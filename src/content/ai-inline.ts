import { createAiPopover, POPOVER_HOST_ID } from './ai-popover';

/** In-page AI-only features (§10.3): explain-highlighted-text and hold-key
 *  word lookup.
 *
 *  Every model call is delegated to the service worker via sendMessage — the
 *  API key must never be read into a page-hosted context, and this file runs
 *  inside the host page. */

const LOOKUP_MODIFIER = 'Alt';
const EXPLAIN_BUTTON_LABEL = 'Explain this';
const MIN_SELECTION_LENGTH = 3;
/** A popover shown within this window isn't dismissed by the trailing events
 *  of the interaction that opened it. */
const DISMISS_GRACE_MS = 400;

interface AiResponse {
  ok: boolean;
  value?: string;
  message?: string;
}

function requestFromWorker(message: Record<string, unknown>): Promise<AiResponse> {
  return chrome.runtime.sendMessage(message) as Promise<AiResponse>;
}

function selectionRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  return rect.width === 0 && rect.height === 0 ? null : rect;
}

/** The word under the pointer, plus its sentence for disambiguation. Uses
 *  caretRangeFromPoint to hit-test text nodes without altering the selection. */
function wordAtPoint(x: number, y: number): { word: string; sentence: string; rect: DOMRect } | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const range = doc.caretRangeFromPoint?.(x, y);
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const text = range.startContainer.textContent ?? '';
  const offset = range.startOffset;
  if (!text.trim()) return null;

  const isBoundary = (char: string) => /\s/.test(char);
  let start = offset;
  let end = offset;
  while (start > 0 && !isBoundary(text[start - 1]!)) start--;
  while (end < text.length && !isBoundary(text[end]!)) end++;

  const word = text.slice(start, end);
  if (!word.trim()) return null;

  const wordRange = document.createRange();
  wordRange.setStart(range.startContainer, start);
  wordRange.setEnd(range.startContainer, end);

  return { word, sentence: text.trim().slice(0, 300), rect: wordRange.getBoundingClientRect() };
}

export function initAiInlineFeatures() {
  if (window.top !== window) return; // top frame only, like the edge tab

  const popover = createAiPopover();
  let modifierHeld = false;
  let lastLookupWord = '';

  // --- Explain highlighted text -------------------------------------------

  async function explainSelection(selection: string, rect: DOMRect) {
    popover.showLoading(rect, 'Explaining…');
    const result = await requestFromWorker({ type: 'ai-explain', text: selection });

    if (!result.ok) {
      popover.showMessage(rect, result.message ?? 'Could not explain this right now.');
      return;
    }

    const explanation = result.value ?? '';
    popover.showMessage(rect, explanation, {
      action: {
        label: 'Explain even more simply',
        onClick: () => void explainSimpler(selection, explanation, rect),
      },
    });
  }

  async function explainSimpler(selection: string, previous: string, rect: DOMRect) {
    popover.showLoading(rect, 'Simplifying…');
    const result = await requestFromWorker({ type: 'ai-explain-simpler', text: selection, previous });

    popover.showMessage(rect, result.ok ? (result.value ?? '') : (result.message ?? 'Could not simplify this.'));
  }

  // A small button appears by the selection rather than explaining on every
  // highlight, so ordinary text selection stays untouched.
  document.addEventListener('mouseup', (event) => {
    // Clicking the popover's own Explain button also fires mouseup here
    // (shadow-DOM events are retargeted to the host). Without this guard the
    // still-active selection would immediately re-show the button, wiping out
    // the answer the click just produced.
    if ((event.target as HTMLElement)?.id === POPOVER_HOST_ID) return;

    // Deferred so the selection is settled by the time it's read.
    setTimeout(() => {
      const selected = window.getSelection()?.toString().trim() ?? '';
      const rect = selectionRect();
      if (selected.length < MIN_SELECTION_LENGTH || !rect) return;

      // A reply rendered moments ago came from this same interaction; don't
      // overwrite it by re-showing the button.
      if (Date.now() - popover.lastShownAt() < DISMISS_GRACE_MS) return;

      popover.showMessage(rect, EXPLAIN_BUTTON_LABEL, {
        action: {
          label: 'Explain',
          onClick: () => void explainSelection(selected, rect),
        },
      });
    }, 0);
  });

  // --- Hold-key word lookup -----------------------------------------------

  window.addEventListener('keydown', (event) => {
    if (event.key === LOOKUP_MODIFIER) modifierHeld = true;
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === LOOKUP_MODIFIER) {
      modifierHeld = false;
      lastLookupWord = '';
    }
  });

  // Releasing focus should not leave a stale "held" state behind.
  window.addEventListener('blur', () => {
    modifierHeld = false;
    lastLookupWord = '';
  });

  document.addEventListener('mousemove', (event) => {
    if (!modifierHeld) return;

    const hit = wordAtPoint(event.clientX, event.clientY);
    if (!hit || hit.word === lastLookupWord) return;

    lastLookupWord = hit.word;
    void (async () => {
      popover.showLoading(hit.rect, 'Looking up…');
      const result = await requestFromWorker({
        type: 'ai-word-lookup',
        word: hit.word,
        sentence: hit.sentence,
      });
      // A later hover may have superseded this one while the call was in
      // flight; only render if this is still the word being pointed at.
      if (lastLookupWord !== hit.word) return;
      popover.showMessage(hit.rect, result.ok ? (result.value ?? '') : (result.message ?? 'Lookup failed.'));
    })();
  });

  // --- Dismissal -----------------------------------------------------------

  document.addEventListener('mousedown', (event) => {
    // Shadow-DOM events are retargeted to the host element, so a click inside
    // the popover surfaces here as the host itself — that's what this check
    // catches.
    if ((event.target as HTMLElement)?.id === POPOVER_HOST_ID) return;

    // Don't dismiss a popover that was opened moments ago by this very
    // interaction. When a reply arrives fast (the gating message when the
    // smart layer is off needs no network call at all), the trailing events of
    // the click that triggered it would otherwise hide the answer instantly —
    // making the feature look like it did nothing.
    if (Date.now() - popover.lastShownAt() < DISMISS_GRACE_MS) return;

    popover.hide();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') popover.hide();
  });
}
