import { describe, it, expect } from 'vitest';
import {
  conditionCodeToScene,
  dayPhaseForHour,
  adviceForScene,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from '../weather-lookup';

describe('dayPhaseForHour', () => {
  it('is day from 6am up to (not including) 6pm', () => {
    expect(dayPhaseForHour(6)).toBe('day');
    expect(dayPhaseForHour(17)).toBe('day');
  });

  it('is evening for the 6-8pm and 5-6am twilight windows', () => {
    expect(dayPhaseForHour(18)).toBe('evening');
    expect(dayPhaseForHour(19)).toBe('evening');
    expect(dayPhaseForHour(5)).toBe('evening');
  });

  it('is night otherwise', () => {
    expect(dayPhaseForHour(23)).toBe('night');
    expect(dayPhaseForHour(0)).toBe('night');
    expect(dayPhaseForHour(3)).toBe('night');
  });
});

describe('conditionCodeToScene', () => {
  it('maps thunderstorm/drizzle/rain codes to rain regardless of time', () => {
    expect(conditionCodeToScene(211, 12)).toBe('rain');
    expect(conditionCodeToScene(301, 23)).toBe('rain');
    expect(conditionCodeToScene(501, 6)).toBe('rain');
  });

  it('maps snow codes to cloudy (no dedicated snow asset)', () => {
    expect(conditionCodeToScene(601, 12)).toBe('cloudy');
  });

  it('maps atmosphere codes (fog/haze) to cloudy', () => {
    expect(conditionCodeToScene(741, 12)).toBe('cloudy');
  });

  it('maps cloud codes (801-804) to cloudy regardless of time', () => {
    expect(conditionCodeToScene(803, 12)).toBe('cloudy');
    expect(conditionCodeToScene(803, 22)).toBe('cloudy');
  });

  it('maps clear sky (800) by time of day: sunny/evening/night', () => {
    expect(conditionCodeToScene(800, 12)).toBe('sunny');
    expect(conditionCodeToScene(800, 19)).toBe('evening');
    expect(conditionCodeToScene(800, 23)).toBe('night');
  });

  it('falls back to cloudy for unrecognized codes', () => {
    expect(conditionCodeToScene(999, 12)).toBe('cloudy');
  });
});

describe('adviceForScene', () => {
  it('returns a non-empty advice string for every scene', () => {
    const scenes = ['sunny', 'cloudy', 'rain', 'evening', 'night'] as const;
    for (const scene of scenes) {
      expect(adviceForScene(scene).length).toBeGreaterThan(0);
    }
  });

  it('mentions umbrella for rain', () => {
    expect(adviceForScene('rain').toLowerCase()).toContain('umbrella');
  });
});

describe('temperature conversion', () => {
  it('converts C to F correctly', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it('converts F to C correctly', () => {
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(212)).toBe(100);
  });
});
