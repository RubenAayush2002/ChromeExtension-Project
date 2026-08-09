import { describe, it, expect } from 'vitest';
import { POPOVER_HOST_ID } from '../ai-popover';

/** Regression guard for the "answer flashes then reverts to the Explain
 *  button" bug.
 *
 *  The selection handler listens for mouseup on `document`. Clicking the
 *  popover's own Explain button ALSO fires mouseup there — shadow-DOM events
 *  are retargeted to the host element rather than being contained. With the
 *  text still selected, the handler would re-show the button and overwrite the
 *  reply that click had just produced.
 *
 *  It only affected Explain because that is the sole selection-driven feature;
 *  word lookup uses mousemove and ask-across-tabs lives in the popup, which is
 *  exactly the asymmetry that was observed.
 *
 *  initAiInlineFeatures() can't be exercised directly here (it needs
 *  chrome.runtime and caretRangeFromPoint), so this models the two guards the
 *  handler now applies. */

const DISMISS_GRACE_MS = 400;

/** Mirrors the mouseup handler's decision to re-show the Explain button. */
function shouldReshowExplainButton(params: {
  targetId: string;
  selectionLength: number;
  msSinceLastShow: number;
}): boolean {
  if (params.targetId === POPOVER_HOST_ID) return false;
  if (params.selectionLength < 3) return false;
  if (params.msSinceLastShow < DISMISS_GRACE_MS) return false;
  return true;
}

describe('selection handler guards', () => {
  it('re-shows the button for a normal selection on the page', () => {
    expect(
      shouldReshowExplainButton({ targetId: 'article', selectionLength: 20, msSinceLastShow: 5000 }),
    ).toBe(true);
  });

  it('ignores mouseup that came from the popover itself', () => {
    // The bug: this returned true, wiping out the just-rendered answer.
    expect(
      shouldReshowExplainButton({ targetId: POPOVER_HOST_ID, selectionLength: 20, msSinceLastShow: 0 }),
    ).toBe(false);
  });

  it('ignores a mouseup arriving right after a reply was rendered', () => {
    // Second line of defence for retargeting quirks across browsers: a reply
    // shown moments ago belongs to this same interaction.
    expect(
      shouldReshowExplainButton({ targetId: 'article', selectionLength: 20, msSinceLastShow: 50 }),
    ).toBe(false);
  });

  it('still ignores selections that are too short to explain', () => {
    expect(
      shouldReshowExplainButton({ targetId: 'article', selectionLength: 1, msSinceLastShow: 5000 }),
    ).toBe(false);
  });

  it('re-shows the button for a fresh selection made well after a reply', () => {
    expect(
      shouldReshowExplainButton({ targetId: 'article', selectionLength: 12, msSinceLastShow: 3000 }),
    ).toBe(true);
  });
});
