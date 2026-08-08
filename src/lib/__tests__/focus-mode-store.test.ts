import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import {
  getFocusModeState,
  setFocusModeActive,
  setBlocklist,
  grantPass,
  pruneExpiredPasses,
  shouldBlockNavigation,
  FIVE_MINUTE_PASS_MS,
} from '../focus-mode-store';

describe('focus-mode-store', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('defaults to inactive with an empty blocklist', async () => {
    const state = await getFocusModeState(chromeFake.storage.local);
    expect(state).toEqual({ active: false, blocklist: [], activePasses: [] });
  });

  it('persists the active toggle independently of blocklist', async () => {
    await setBlocklist(chromeFake.storage.local, ['twitter.com']);
    await setFocusModeActive(chromeFake.storage.local, true);
    const state = await getFocusModeState(chromeFake.storage.local);
    expect(state.active).toBe(true);
    expect(state.blocklist).toEqual(['twitter.com']);
  });

  it('grants a 5-minute pass for a host', async () => {
    const now = 1_000_000;
    await grantPass(chromeFake.storage.local, 'twitter.com', now);
    const state = await getFocusModeState(chromeFake.storage.local);
    expect(state.activePasses).toEqual([{ host: 'twitter.com', expiresAt: now + FIVE_MINUTE_PASS_MS }]);
  });

  it('replaces an existing pass for the same host rather than duplicating it', async () => {
    await grantPass(chromeFake.storage.local, 'twitter.com', 1000);
    await grantPass(chromeFake.storage.local, 'twitter.com', 2000);
    const state = await getFocusModeState(chromeFake.storage.local);
    expect(state.activePasses).toHaveLength(1);
    expect(state.activePasses[0]!.expiresAt).toBe(2000 + FIVE_MINUTE_PASS_MS);
  });

  it('prunes expired passes but keeps still-valid ones', async () => {
    await grantPass(chromeFake.storage.local, 'expired.com', 1000);
    await grantPass(chromeFake.storage.local, 'still-valid.com', 1_000_000_000);

    await pruneExpiredPasses(chromeFake.storage.local, 1000 + FIVE_MINUTE_PASS_MS + 1);

    const state = await getFocusModeState(chromeFake.storage.local);
    expect(state.activePasses.map((p) => p.host)).toEqual(['still-valid.com']);
  });
});

describe('shouldBlockNavigation', () => {
  const now = 1_000_000;

  it('does not block when focus mode is inactive', () => {
    const state = { active: false, blocklist: ['twitter.com'], activePasses: [] };
    expect(shouldBlockNavigation(state, 'twitter.com', now)).toBe(false);
  });

  it('does not block a non-blocklisted host', () => {
    const state = { active: true, blocklist: ['twitter.com'], activePasses: [] };
    expect(shouldBlockNavigation(state, 'example.com', now)).toBe(false);
  });

  it('blocks a blocklisted host while active with no pass', () => {
    const state = { active: true, blocklist: ['twitter.com'], activePasses: [] };
    expect(shouldBlockNavigation(state, 'twitter.com', now)).toBe(true);
  });

  it('does not block a host with an active, unexpired pass', () => {
    const state = {
      active: true,
      blocklist: ['twitter.com'],
      activePasses: [{ host: 'twitter.com', expiresAt: now + 1000 }],
    };
    expect(shouldBlockNavigation(state, 'twitter.com', now)).toBe(false);
  });

  it('blocks again once the pass has expired', () => {
    const state = {
      active: true,
      blocklist: ['twitter.com'],
      activePasses: [{ host: 'twitter.com', expiresAt: now - 1000 }],
    };
    expect(shouldBlockNavigation(state, 'twitter.com', now)).toBe(true);
  });
});
