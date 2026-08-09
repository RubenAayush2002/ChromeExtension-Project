import type { LocalStorage } from './storage-types';

export interface SmartLayerSettings {
  enabled: boolean;
  apiKey: string;
  keyVerified: boolean;
}

const STORAGE_KEY = 'smartLayer';

const DEFAULT_SETTINGS: SmartLayerSettings = { enabled: false, apiKey: '', keyVerified: false };

export async function getSmartLayerSettings(storage: LocalStorage): Promise<SmartLayerSettings> {
  const { [STORAGE_KEY]: stored } = await storage.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...((stored as Partial<SmartLayerSettings> | undefined) ?? {}) };
}

async function setSmartLayerSettings(storage: LocalStorage, settings: SmartLayerSettings): Promise<void> {
  await storage.set({ [STORAGE_KEY]: settings });
}

/** Saves a new key. Any previously recorded verification is cleared, since it
 *  applied to the old key — the user has to re-test before the master toggle
 *  can be turned on again (§10.1). */
export async function setApiKey(storage: LocalStorage, apiKey: string): Promise<void> {
  const settings = await getSmartLayerSettings(storage);
  const changed = apiKey !== settings.apiKey;
  await setSmartLayerSettings(storage, {
    ...settings,
    apiKey,
    keyVerified: changed ? false : settings.keyVerified,
    // A key that's been cleared can't leave the layer enabled behind it.
    enabled: apiKey ? settings.enabled : false,
  });
}

export async function setKeyVerified(storage: LocalStorage, keyVerified: boolean): Promise<void> {
  const settings = await getSmartLayerSettings(storage);
  await setSmartLayerSettings(storage, { ...settings, keyVerified });
}

/** §10.1: the master toggle can only be turned on once a key exists. Returns
 *  whether the requested state was applied. */
export async function setSmartLayerEnabled(storage: LocalStorage, enabled: boolean): Promise<boolean> {
  const settings = await getSmartLayerSettings(storage);
  if (enabled && !settings.apiKey) return false;

  await setSmartLayerSettings(storage, { ...settings, enabled });
  return true;
}

/** Whether smart-mode calls should actually be attempted: the master toggle is
 *  on and a key is present. Every upgraded feature checks this before calling
 *  out, and falls back to its simple mode when it's false. */
export function isSmartModeActive(settings: SmartLayerSettings): boolean {
  return settings.enabled && settings.apiKey.length > 0;
}

/** Masks a key for display (§10.1) — shows only the last 4 characters, e.g.
 *  "gsk_...a1b2". Never returns the full key. */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 4) return '•'.repeat(apiKey.length);
  return `${'•'.repeat(8)}${apiKey.slice(-4)}`;
}
