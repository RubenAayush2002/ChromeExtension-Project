import { resolveEffectiveMode, type ThemeSettings } from '@/lib/theme-resolve';

export type { ThemeSettings };

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: ThemeSettings = { mode: 'auto', autoBasis: 'system' };

export async function getTheme(): Promise<ThemeSettings> {
  const { [STORAGE_KEY]: theme } = await chrome.storage.local.get(STORAGE_KEY);
  return (theme as ThemeSettings | undefined) ?? DEFAULT_THEME;
}

export async function setTheme(theme: ThemeSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: theme });
}

export function applyTheme(theme: ThemeSettings, now: Date = new Date()): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = resolveEffectiveMode(theme, now.getHours(), prefersDark);
  document.documentElement.setAttribute('data-theme', effective);
}
