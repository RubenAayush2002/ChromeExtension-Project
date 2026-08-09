import { describe, it, expect, beforeEach } from 'vitest';
import { createAiPopover } from '../ai-popover';

const RECT = { left: 10, bottom: 20, width: 40, height: 10 } as DOMRect;

/** The popover uses a closed shadow root, so its internals aren't reachable
 *  from a test. lastShownAt() is the observable signal that a show happened,
 *  which is exactly what the dismissal grace period depends on. */
describe('ai popover', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('attaches a host element to the page', () => {
    createAiPopover();
    expect(document.getElementById('personal-home-base-ai-popover')).not.toBeNull();
  });

  it('records a timestamp when a message is shown', () => {
    const popover = createAiPopover();
    const before = Date.now();

    popover.showMessage(RECT, 'the gating message');

    expect(popover.lastShownAt()).toBeGreaterThanOrEqual(before);
  });

  it('records a timestamp when the loading state is shown', () => {
    const popover = createAiPopover();
    const before = Date.now();

    popover.showLoading(RECT, 'Explaining…');

    expect(popover.lastShownAt()).toBeGreaterThanOrEqual(before);
  });

  it('reports no show before anything is displayed', () => {
    const popover = createAiPopover();
    expect(popover.lastShownAt()).toBe(0);
  });

  it('keeps the timestamp fresh across a hide-then-show cycle', () => {
    const popover = createAiPopover();

    popover.showMessage(RECT, 'first');
    popover.hide();
    const before = Date.now();
    popover.showMessage(RECT, 'This needs the smart layer turned on in Settings');

    // Regression guard: when the smart layer is off the reply needs no network
    // call and arrives almost instantly. The dismissal handler consults this
    // timestamp to avoid hiding that message with the trailing events of the
    // very click that triggered it — which made the feature look dead.
    expect(popover.lastShownAt()).toBeGreaterThanOrEqual(before);
  });

  it('does not throw when shown near a viewport edge', () => {
    const popover = createAiPopover();
    const edgeRect = { left: 5000, bottom: 4000, width: 10, height: 10 } as DOMRect;

    expect(() => popover.showMessage(edgeRect, 'clamped')).not.toThrow();
  });
});
