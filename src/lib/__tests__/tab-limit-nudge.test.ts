import { describe, it, expect } from 'vitest';
import { shouldNotify, recordNotified, recordBelowThreshold, type NudgeState } from '../tab-limit-nudge';

describe('shouldNotify', () => {
  const fresh: NudgeState = { lastNotifiedAtCount: null };

  it('does not notify when below threshold', () => {
    expect(shouldNotify(5, 10, fresh)).toBe(false);
  });

  it('notifies on first crossing of the threshold', () => {
    expect(shouldNotify(10, 10, fresh)).toBe(true);
    expect(shouldNotify(11, 10, fresh)).toBe(true);
  });

  it('does not re-notify on every subsequent tab opened past the threshold', () => {
    const afterFirstNotify = recordNotified(10);
    expect(shouldNotify(11, 10, afterFirstNotify)).toBe(false);
    expect(shouldNotify(15, 10, afterFirstNotify)).toBe(false);
  });

  it('re-notifies after dropping below threshold and crossing again', () => {
    const afterFirstNotify = recordNotified(10);
    const afterDropping = recordBelowThreshold();
    expect(shouldNotify(9, 10, afterFirstNotify)).toBe(false); // still below, no notify
    expect(shouldNotify(10, 10, afterDropping)).toBe(true);
  });
});
