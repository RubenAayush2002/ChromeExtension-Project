export interface Settings {
  name: string;
  searchEngine: 'google' | 'duckduckgo' | 'bing';
}

const STORAGE_KEY = 'settings';
const DEFAULT_SETTINGS: Settings = { name: '', searchEngine: 'google' };

export async function getSettings(): Promise<Settings> {
  const { [STORAGE_KEY]: settings } = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}
