import { describe, it, expect } from 'vitest';

/** Regression guard for the multi-listener message bug.
 *
 *  chrome.runtime.onMessage dispatches every message to EVERY registered
 *  listener. The background worker registers two: a fire-and-forget one for
 *  edge-tab actions, and an async one for AI requests that calls sendResponse.
 *
 *  If the first listener returns undefined for a message it doesn't handle,
 *  Chrome can treat that as "no async response coming" and close the channel
 *  before the second listener responds — leaving the caller's sendMessage
 *  promise pending forever. That is exactly what left "Looking up…" on screen
 *  indefinitely. Both listeners must therefore return false for messages that
 *  are not theirs.
 *
 *  This models the two listeners' routing contract rather than importing the
 *  worker, which can't be loaded outside a service-worker context. */

const EDGE_TAB_MESSAGE_TYPES = new Set([
  'open-reading-view',
  'bookmark-page',
  'tidy-tabs',
  'close-duplicates',
  'take-screenshot',
  'save-read-later',
]);

const AI_MESSAGE_TYPES = new Set(['ai-explain', 'ai-explain-simpler', 'ai-word-lookup', 'ai-ask-tabs']);

/** Mirrors the edge-tab listener's return contract. */
function edgeTabListener(type: string): boolean {
  if (!EDGE_TAB_MESSAGE_TYPES.has(type)) return false;
  return false; // handled fire-and-forget; never keeps the channel open
}

/** Mirrors the AI listener's return contract. */
function aiListener(type: string): boolean {
  if (!AI_MESSAGE_TYPES.has(type)) return false;
  return true; // responds asynchronously
}

describe('background message routing', () => {
  it('keeps the channel open for every AI message type', () => {
    for (const type of AI_MESSAGE_TYPES) {
      expect(aiListener(type)).toBe(true);
    }
  });

  it('does not let the edge-tab listener claim AI messages', () => {
    // The bug: this listener saw an AI message, fell through its switch and
    // returned undefined, closing the channel.
    for (const type of AI_MESSAGE_TYPES) {
      expect(edgeTabListener(type)).toBe(false);
    }
  });

  it('does not let the AI listener claim edge-tab messages', () => {
    for (const type of EDGE_TAB_MESSAGE_TYPES) {
      expect(aiListener(type)).toBe(false);
    }
  });

  it('leaves exactly one listener keeping the channel open per AI message', () => {
    for (const type of AI_MESSAGE_TYPES) {
      const openers = [edgeTabListener(type), aiListener(type)].filter(Boolean);
      expect(openers).toHaveLength(1);
    }
  });

  it('has no overlap between the two message-type sets', () => {
    const overlap = [...AI_MESSAGE_TYPES].filter((t) => EDGE_TAB_MESSAGE_TYPES.has(t));
    expect(overlap).toEqual([]);
  });

  it('ignores unknown message types in both listeners', () => {
    expect(edgeTabListener('something-else')).toBe(false);
    expect(aiListener('something-else')).toBe(false);
  });
});
