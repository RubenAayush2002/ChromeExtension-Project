export type WeatherScene = 'sunny' | 'cloudy' | 'rain' | 'evening' | 'night';

export type DayPhase = 'day' | 'evening' | 'night';

/** Buckets an hour (0-23) into day/evening/night for scene selection.
 *  Evening covers dusk/dawn twilight hours; the rest split at 6am/8pm. */
export function dayPhaseForHour(hour: number): DayPhase {
  if (hour >= 6 && hour < 18) return 'day';
  if ((hour >= 18 && hour < 20) || (hour >= 5 && hour < 6)) return 'evening';
  return 'night';
}

/**
 * OpenWeatherMap condition codes: https://openweathermap.org/weather-conditions
 * Grouped into the 5 static scenes this build ships (§6.3.4): sunny, cloudy,
 * rain, evening, night. Clear-sky/cloud conditions are further split by time
 * of day via `dayPhaseForHour` — evening/night take priority over "sunny" so
 * a clear evening or night sky doesn't render as a bright daytime scene.
 * Snow condition codes (600-699) have no dedicated asset and fall back to cloudy.
 */
export function conditionCodeToScene(code: number, hour: number): WeatherScene {
  const phase = dayPhaseForHour(hour);

  if (code >= 200 && code < 300) return 'rain'; // thunderstorm
  if (code >= 300 && code < 400) return 'rain'; // drizzle
  if (code >= 500 && code < 600) return 'rain'; // rain
  if (code >= 600 && code < 700) return 'cloudy'; // snow — no dedicated asset yet
  if (code >= 700 && code < 800) return 'cloudy'; // atmosphere (fog, haze, etc.)
  if (code === 800) {
    // clear sky
    if (phase === 'night') return 'night';
    if (phase === 'evening') return 'evening';
    return 'sunny';
  }
  if (code > 800 && code < 900) return 'cloudy'; // clouds
  return 'cloudy';
}

const ADVICE_TABLE: Record<WeatherScene, string> = {
  sunny: 'Clear skies — good day to be outside.',
  cloudy: 'Overcast — nothing dramatic, dress as usual.',
  rain: 'Looks like rain — carry an umbrella.',
  evening: 'Clear evening — a calm one out there.',
  night: 'Clear night — should be calm out there.',
};

export function adviceForScene(scene: WeatherScene): string {
  return ADVICE_TABLE[scene];
}

export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return Math.round(((fahrenheit - 32) * 5) / 9);
}
