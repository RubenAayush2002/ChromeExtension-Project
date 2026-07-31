import type { LocalStorage } from './storage-types';

export type BackgroundMode = 'gradient' | 'photo' | 'curatedArt' | 'weatherMatched';

export interface BackgroundSettings {
  mode: BackgroundMode;
  selectedId: string | null;
}

const STORAGE_KEY = 'background';

const DEFAULT_SETTINGS: BackgroundSettings = { mode: 'gradient', selectedId: null };

export async function getBackgroundSettings(storage: LocalStorage): Promise<BackgroundSettings> {
  const { [STORAGE_KEY]: settings } = await storage.get(STORAGE_KEY);
  return (settings as BackgroundSettings | undefined) ?? DEFAULT_SETTINGS;
}

/** Persists a background mode/selection choice. Never touches the network for
 *  any mode — gradients/photos/curated art are bundled or IndexedDB-stored,
 *  and weather-matched scenery reuses the already-fetched weather reading. */
export async function setBackgroundSettings(
  storage: LocalStorage,
  settings: BackgroundSettings,
): Promise<void> {
  await storage.set({ [STORAGE_KEY]: settings });
}
