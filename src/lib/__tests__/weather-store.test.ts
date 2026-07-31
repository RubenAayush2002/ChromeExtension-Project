import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import { fetchWeather, buildReadingFromApiResponse, formatLastUpdated } from '../weather-store';

describe('weather-store', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('returns a "not configured" message when no city/key is set', async () => {
    const result = await fetchWeather(chromeFake.storage.local, async () => {
      throw new Error('should not be called');
    });
    expect(result.reading).toBeNull();
    expect(result.stale).toBe(true);
    expect(result.error).toMatch(/not configured/i);
  });

  it('fetches and caches a live reading on success', async () => {
    await chromeFake.storage.local.set({ weather: { city: 'London', apiKey: 'key123', lastReading: null } });
    const reading = buildReadingFromApiResponse('London', 18, 500, Date.now());

    const result = await fetchWeather(chromeFake.storage.local, async () => reading);

    expect(result.stale).toBe(false);
    expect(result.error).toBeNull();
    expect(result.reading).toEqual(reading);

    const { weather } = await chromeFake.storage.local.get('weather');
    expect((weather as any).lastReading).toEqual(reading);
  });

  it('falls back to the last cached reading with an error note when the live fetch fails', async () => {
    const cached = buildReadingFromApiResponse('London', 15, 800, Date.now() - 60_000);
    await chromeFake.storage.local.set({ weather: { city: 'London', apiKey: 'key123', lastReading: cached } });

    const result = await fetchWeather(chromeFake.storage.local, async () => {
      throw new Error('network error');
    });

    expect(result.stale).toBe(true);
    expect(result.reading).toEqual(cached);
    expect(result.error).toMatch(/network error/i);
  });
});

describe('formatLastUpdated', () => {
  it('formats sub-minute as "just now"', () => {
    expect(formatLastUpdated(1000, 1000 + 30_000)).toBe('just now');
  });

  it('formats minutes, hours, and days', () => {
    const base = 0;
    expect(formatLastUpdated(base, base + 5 * 60_000)).toBe('5m ago');
    expect(formatLastUpdated(base, base + 3 * 3_600_000)).toBe('3h ago');
    expect(formatLastUpdated(base, base + 2 * 86_400_000)).toBe('2d ago');
  });
});
