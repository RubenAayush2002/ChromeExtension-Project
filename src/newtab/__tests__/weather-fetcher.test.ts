import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWeatherFromOpenWeatherMap } from '../weather-fetcher';

const GEOCODE_DUBLIN_IE = [{ name: 'Dublin', lat: 53.3498, lon: -6.2603, country: 'IE' }];
const GEOCODE_DUBLIN_US = [{ name: 'Dublin', lat: 37.7021, lon: -121.9358, country: 'US', state: 'California' }];

function weatherPayload(temp: number, conditionId = 803) {
  return { name: 'Dublin', main: { temp }, weather: [{ id: conditionId }] };
}

function mockFetch(handlers: { geocode: unknown; weather: unknown }) {
  return vi.fn(async (url: string | URL) => {
    const href = String(url);
    const body = href.includes('/geo/1.0/direct') ? handlers.geocode : handlers.weather;
    return { ok: true, status: 200, json: async () => body } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWeatherFromOpenWeatherMap', () => {
  it('geocodes the city before fetching weather', async () => {
    const fetchMock = mockFetch({ geocode: GEOCODE_DUBLIN_IE, weather: weatherPayload(16) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWeatherFromOpenWeatherMap('Dublin,IE', 'key');

    const [geocodeUrl, weatherUrl] = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(geocodeUrl).toContain('/geo/1.0/direct');
    // The weather call must use coordinates, not a bare name — the ambiguous
    // `q=Dublin` lookup is what returned a US city's temperature.
    expect(weatherUrl).toContain('lat=53.3498');
    expect(weatherUrl).toContain('lon=-6.2603');
    expect(weatherUrl).not.toContain('q=');
  });

  it('requests metric units so the temperature is degrees Celsius', async () => {
    const fetchMock = mockFetch({ geocode: GEOCODE_DUBLIN_IE, weather: weatherPayload(16) });
    vi.stubGlobal('fetch', fetchMock);

    const reading = await fetchWeatherFromOpenWeatherMap('Dublin,IE', 'key');

    expect(String(fetchMock.mock.calls[1]![0])).toContain('units=metric');
    expect(reading.tempC).toBe(16);
  });

  it('passes a country-coded entry through to the geocoder', async () => {
    const fetchMock = mockFetch({ geocode: GEOCODE_DUBLIN_IE, weather: weatherPayload(16) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWeatherFromOpenWeatherMap('Dublin,IE', 'key');

    expect(String(fetchMock.mock.calls[0]![0])).toContain(encodeURIComponent('Dublin,IE'));
  });

  it('shows the resolved country so a wrong match is visible', async () => {
    const fetchMock = mockFetch({ geocode: GEOCODE_DUBLIN_IE, weather: weatherPayload(16) });
    vi.stubGlobal('fetch', fetchMock);

    const reading = await fetchWeatherFromOpenWeatherMap('Dublin', 'key');

    expect(reading.place).toBe('Dublin, IE');
  });

  it('includes the state for US matches, making the ambiguity obvious', async () => {
    const fetchMock = mockFetch({ geocode: GEOCODE_DUBLIN_US, weather: weatherPayload(35) });
    vi.stubGlobal('fetch', fetchMock);

    const reading = await fetchWeatherFromOpenWeatherMap('Dublin', 'key');

    // This is the bug's original symptom: 35°C. Now it is plainly labelled as
    // the American Dublin rather than silently mislabelled.
    expect(reading.place).toBe('Dublin, California, US');
  });

  it('reports a helpful error when the place cannot be found', async () => {
    vi.stubGlobal('fetch', mockFetch({ geocode: [], weather: weatherPayload(16) }));

    await expect(fetchWeatherFromOpenWeatherMap('Nowhereville', 'key')).rejects.toThrow(/Nowhereville/);
  });

  it('surfaces a failed geocode request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response),
    );

    await expect(fetchWeatherFromOpenWeatherMap('Dublin,IE', 'bad-key')).rejects.toThrow(/401/);
  });

  it('surfaces a failed weather request after a successful geocode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const ok = String(url).includes('/geo/1.0/direct');
        return {
          ok,
          status: ok ? 200 : 500,
          json: async () => (ok ? GEOCODE_DUBLIN_IE : {}),
        } as Response;
      }),
    );

    await expect(fetchWeatherFromOpenWeatherMap('Dublin,IE', 'key')).rejects.toThrow(/500/);
  });
});
