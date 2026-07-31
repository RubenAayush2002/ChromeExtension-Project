import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import { getFocus, setFocus, resetFocusForNewDay, FOCUS_MIDNIGHT_ALARM } from '../focus-store';

describe('focus-store', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('returns empty string when nothing has been set', async () => {
    const now = new Date('2026-07-29T09:00:00');
    expect(await getFocus(chromeFake.storage.local, now)).toBe('');
  });

  it('persists focus text intra-day', async () => {
    const now = new Date('2026-07-29T09:00:00');
    await setFocus(chromeFake.storage.local, 'Ship Phase 1', now);
    expect(await getFocus(chromeFake.storage.local, now)).toBe('Ship Phase 1');
  });

  it('does not leak yesterday\'s focus as a hint (returns empty if date has changed without a reset)', async () => {
    const yesterday = new Date('2026-07-29T09:00:00');
    await setFocus(chromeFake.storage.local, 'Ship Phase 1', yesterday);

    const today = new Date('2026-07-30T09:00:00');
    expect(await getFocus(chromeFake.storage.local, today)).toBe('');
  });

  it('clears focus when the midnight alarm fires', async () => {
    const now = new Date('2026-07-29T09:00:00');
    await setFocus(chromeFake.storage.local, 'Ship Phase 1', now);

    chromeFake.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === FOCUS_MIDNIGHT_ALARM) {
        await resetFocusForNewDay(chromeFake.storage.local, new Date('2026-07-30T00:00:00'));
      }
    });
    chromeFake.alarms.__fire(FOCUS_MIDNIGHT_ALARM);

    expect(await getFocus(chromeFake.storage.local, new Date('2026-07-30T00:00:01'))).toBe('');
  });
});
