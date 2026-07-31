import { buildReadingFromApiResponse } from '@/lib/weather-store';
import type { WeatherFetcher } from '@/lib/weather-store';

interface OpenWeatherMapResponse {
  name: string;
  main: { temp: number };
  weather: Array<{ id: number }>;
}

export const fetchWeatherFromOpenWeatherMap: WeatherFetcher = async (city, apiKey) => {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(apiKey)}&units=metric`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather lookup failed (${response.status})`);
  }
  const data = (await response.json()) as OpenWeatherMapResponse;
  const condition = data.weather[0];
  return buildReadingFromApiResponse(data.name, data.main.temp, condition?.id ?? 800, Date.now());
};
