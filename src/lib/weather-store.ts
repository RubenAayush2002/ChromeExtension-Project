import { conditionCodeToScene, type WeatherScene } from './weather-lookup';
import type { LocalStorage } from './storage-types';

export interface WeatherReading {
  tempC: number;
  place: string;
  conditionCode: number;
  scene: WeatherScene;
  fetchedAt: number;
}

export interface WeatherResult {
  reading: WeatherReading | null;
  stale: boolean; // true if this is a cached reading due to a failed live fetch
  error: string | null;
}

export type WeatherFetcher = (city: string, apiKey: string) => Promise<WeatherReading>;

const STORAGE_KEY = 'weather';

interface WeatherStorageShape {
  city: string;
  apiKey: string;
  lastReading: WeatherReading | null;
}

export async function fetchWeather(
  storage: LocalStorage,
  fetcher: WeatherFetcher,
): Promise<WeatherResult> {
  const { [STORAGE_KEY]: stored } = await storage.get(STORAGE_KEY);
  const settings = stored as WeatherStorageShape | undefined;

  if (!settings?.city || !settings?.apiKey) {
    return { reading: settings?.lastReading ?? null, stale: true, error: 'Weather is not configured yet.' };
  }

  try {
    const reading = await fetcher(settings.city, settings.apiKey);
    await storage.set({ [STORAGE_KEY]: { ...settings, lastReading: reading } });
    return { reading, stale: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Weather lookup failed.';
    return { reading: settings.lastReading ?? null, stale: true, error: message };
  }
}

export function buildReadingFromApiResponse(
  place: string,
  tempC: number,
  conditionCode: number,
  now: number,
): WeatherReading {
  const hour = new Date(now).getHours();
  return {
    tempC,
    place,
    conditionCode,
    scene: conditionCodeToScene(conditionCode, hour),
    fetchedAt: now,
  };
}

export function formatLastUpdated(fetchedAt: number, now: number): string {
  const diffMs = now - fetchedAt;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
