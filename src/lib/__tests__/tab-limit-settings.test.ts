import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import {
  getTabLimitThreshold,
  setTabLimitThreshold,
  getNudgeState,
  setNudgeState,
} from '../tab-limit-settings';

describe('tab-limit-settings', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('defaults the threshold to 20 when unset', async () => {
    expect(await getTabLimitThreshold(chromeFake.storage.local)).toBe(20);
  });

  it('persists a custom threshold', async () => {
    await setTabLimitThreshold(chromeFake.storage.local, 15);
    expect(await getTabLimitThreshold(chromeFake.storage.local)).toBe(15);
  });

  it('defaults nudge state to null lastNotifiedAtCount when unset', async () => {
    expect(await getNudgeState(chromeFake.storage.local)).toEqual({ lastNotifiedAtCount: null });
  });

  it('persists nudge state', async () => {
    await setNudgeState(chromeFake.storage.local, { lastNotifiedAtCount: 25 });
    expect(await getNudgeState(chromeFake.storage.local)).toEqual({ lastNotifiedAtCount: 25 });
  });
});
