import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import {
  getSmartLayerSettings,
  setApiKey,
  setKeyVerified,
  setSmartLayerEnabled,
  isSmartModeActive,
  maskApiKey,
} from '../smart-layer-store';

describe('smart layer settings', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('defaults to off with no key', async () => {
    const settings = await getSmartLayerSettings(chromeFake.storage.local);
    expect(settings).toEqual({ enabled: false, apiKey: '', keyVerified: false });
  });

  it('refuses to enable the master toggle without a key', async () => {
    const applied = await setSmartLayerEnabled(chromeFake.storage.local, true);

    expect(applied).toBe(false);
    expect((await getSmartLayerSettings(chromeFake.storage.local)).enabled).toBe(false);
  });

  it('enables the master toggle once a key exists', async () => {
    await setApiKey(chromeFake.storage.local, 'gsk_test_key');
    const applied = await setSmartLayerEnabled(chromeFake.storage.local, true);

    expect(applied).toBe(true);
    expect((await getSmartLayerSettings(chromeFake.storage.local)).enabled).toBe(true);
  });

  it('clears a previous verification when the key changes', async () => {
    await setApiKey(chromeFake.storage.local, 'gsk_original');
    await setKeyVerified(chromeFake.storage.local, true);

    await setApiKey(chromeFake.storage.local, 'gsk_different');

    expect((await getSmartLayerSettings(chromeFake.storage.local)).keyVerified).toBe(false);
  });

  it('keeps verification when the same key is saved again', async () => {
    await setApiKey(chromeFake.storage.local, 'gsk_same');
    await setKeyVerified(chromeFake.storage.local, true);

    await setApiKey(chromeFake.storage.local, 'gsk_same');

    expect((await getSmartLayerSettings(chromeFake.storage.local)).keyVerified).toBe(true);
  });

  it('turns the layer off when the key is cleared', async () => {
    await setApiKey(chromeFake.storage.local, 'gsk_test_key');
    await setSmartLayerEnabled(chromeFake.storage.local, true);

    await setApiKey(chromeFake.storage.local, '');

    const settings = await getSmartLayerSettings(chromeFake.storage.local);
    expect(settings.enabled).toBe(false);
    expect(isSmartModeActive(settings)).toBe(false);
  });

  it('treats smart mode as inactive when enabled but keyless', () => {
    expect(isSmartModeActive({ enabled: true, apiKey: '', keyVerified: false })).toBe(false);
    expect(isSmartModeActive({ enabled: false, apiKey: 'gsk_k', keyVerified: true })).toBe(false);
    expect(isSmartModeActive({ enabled: true, apiKey: 'gsk_k', keyVerified: true })).toBe(true);
  });
});

describe('maskApiKey', () => {
  it('shows only the last four characters', () => {
    expect(maskApiKey('gsk_abcdefghijkl1234')).toBe('••••••••1234');
  });

  it('never leaks the body of the key', () => {
    expect(maskApiKey('gsk_supersecretvalue')).not.toContain('supersecret');
  });

  it('fully masks very short keys', () => {
    expect(maskApiKey('abcd')).toBe('••••');
  });

  it('returns empty for no key', () => {
    expect(maskApiKey('')).toBe('');
  });
});
