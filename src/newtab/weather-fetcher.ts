import { buildReadingFromApiResponse } from '@/lib/weather-store';
import type { WeatherFetcher } from '@/lib/weather-store';

interface OpenWeatherMapResponse {
  name: string;
  main: { temp: number };
  weather: Array<{ id: number }>;
}

interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

/** Resolves a place name to coordinates via OpenWeatherMap's geocoding API.
 *
 *  The weather endpoint's own `q=` lookup is ambiguous for names that exist in
 *  several countries — a bare "Dublin" resolves to Dublin, California rather
 *  than Dublin, Ireland. Geocoding first, then fetching by lat/lon, removes
 *  that guesswork. A "City,CC" entry (e.g. "Dublin,IE") is passed straight
 *  through, since the geocoder accepts the same syntax and it disambiguates
 *  exactly. */
async function geocodeCity(city: string, apiKey: string): Promise<GeocodeResult> {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Couldn't look up that place (${response.status})`);
  }

  const results = (await response.json()) as GeocodeResult[];
  const match = results[0];
  if (!match) {
    throw new Error(`Couldn't find a place called "${city}".`);
  }
  return match;
}

/** Formats the resolved place for display, including the country (and US
 *  state) so an ambiguous entry is visibly disambiguated — if "Dublin" did
 *  resolve to the wrong one, the corner now shows "Dublin, US" rather than
 *  silently reporting the wrong city's weather. */
function formatPlace(match: GeocodeResult): string {
  const region = match.state && match.country === 'US' ? `${match.state}, ` : '';
  return `${match.name}, ${region}${match.country}`;
}

export const fetchWeatherFromOpenWeatherMap: WeatherFetcher = async (city, apiKey) => {
  const match = await geocodeCity(city, apiKey);

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${match.lat}&lon=${match.lon}&appid=${encodeURIComponent(apiKey)}&units=metric`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather lookup failed (${response.status})`);
  }

  const data = (await response.json()) as OpenWeatherMapResponse;
  const condition = data.weather[0];
  return buildReadingFromApiResponse(formatPlace(match), data.main.temp, condition?.id ?? 800, Date.now());
};
