import { getSettings, setSettings } from '@/newtab/settings';
import { getTheme, setTheme } from '@/newtab/theme';
import { getBackgroundSettings, setBackgroundSettings } from '@/lib/background-store';

const WEATHER_KEY = 'weather';

interface WeatherSettingsShape {
  city: string;
  apiKey: string;
  lastReading: unknown;
}

async function getWeatherSettings(): Promise<WeatherSettingsShape> {
  const { [WEATHER_KEY]: stored } = await chrome.storage.local.get(WEATHER_KEY);
  const settings = stored as WeatherSettingsShape | undefined;
  return settings ?? { city: '', apiKey: '', lastReading: null };
}

async function setWeatherSettings(city: string, apiKey: string): Promise<void> {
  const existing = await getWeatherSettings();
  await chrome.storage.local.set({
    [WEATHER_KEY]: { city, apiKey, lastReading: existing.lastReading },
  });
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

async function loadForm() {
  const [settings, theme, background, weather] = await Promise.all([
    getSettings(),
    getTheme(),
    getBackgroundSettings(chrome.storage.local),
    getWeatherSettings(),
  ]);

  el<HTMLInputElement>('name').value = settings.name;
  el<HTMLSelectElement>('search-engine').value = settings.searchEngine;

  el<HTMLSelectElement>('theme-mode').value = theme.mode;
  el<HTMLSelectElement>('theme-auto-basis').value = theme.autoBasis;
  el<HTMLInputElement>('theme-start-hour').value = String(theme.timeRange?.start ?? 20);
  el<HTMLInputElement>('theme-end-hour').value = String(theme.timeRange?.end ?? 6);

  el<HTMLInputElement>('weather-city').value = weather.city;
  el<HTMLInputElement>('weather-api-key').value = weather.apiKey;
  el<HTMLInputElement>('weather-matched-scenery').checked = background.mode === 'weatherMatched';

  updateVisibility();
}

function updateVisibility() {
  const mode = el<HTMLSelectElement>('theme-mode').value;
  el('auto-theme-options').hidden = mode !== 'auto';

  const basis = el<HTMLSelectElement>('theme-auto-basis').value;
  el('time-range-options').hidden = basis !== 'time';
}

async function save() {
  await setSettings({
    name: el<HTMLInputElement>('name').value.trim(),
    searchEngine: el<HTMLSelectElement>('search-engine').value as 'google' | 'duckduckgo' | 'bing',
  });

  const mode = el<HTMLSelectElement>('theme-mode').value as 'light' | 'dark' | 'auto';
  const autoBasis = el<HTMLSelectElement>('theme-auto-basis').value as 'system' | 'time';
  await setTheme({
    mode,
    autoBasis,
    timeRange:
      autoBasis === 'time'
        ? {
            start: Number(el<HTMLInputElement>('theme-start-hour').value),
            end: Number(el<HTMLInputElement>('theme-end-hour').value),
          }
        : undefined,
  });

  await setWeatherSettings(
    el<HTMLInputElement>('weather-city').value.trim(),
    el<HTMLInputElement>('weather-api-key').value.trim(),
  );

  const weatherMatched = el<HTMLInputElement>('weather-matched-scenery').checked;
  if (weatherMatched) {
    await setBackgroundSettings(chrome.storage.local, { mode: 'weatherMatched', selectedId: null });
  } else {
    const current = await getBackgroundSettings(chrome.storage.local);
    if (current.mode === 'weatherMatched') {
      await setBackgroundSettings(chrome.storage.local, { mode: 'gradient', selectedId: null });
    }
  }

  const status = el<HTMLParagraphElement>('save-status');
  status.hidden = false;
  status.textContent = 'Saved.';
  window.setTimeout(() => {
    status.hidden = true;
  }, 2000);
}

el<HTMLSelectElement>('theme-mode').addEventListener('change', updateVisibility);
el<HTMLSelectElement>('theme-auto-basis').addEventListener('change', updateVisibility);
el<HTMLButtonElement>('save-button').addEventListener('click', () => void save());

void loadForm();
