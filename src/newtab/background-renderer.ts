import type { BackgroundSettings } from '@/lib/background-store';
import type { WeatherScene } from '@/lib/weather-lookup';
import { curatedArtSlotForHour } from '@/lib/curated-art-time';

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #6d83f2, #a480f2)';

/** Built-in CSS gradient presets (§6.3.1). No network, no storage cost. */
export const GRADIENTS: Record<string, string> = {
  default: DEFAULT_GRADIENT,
  dusk: 'linear-gradient(135deg, #2b5876, #4e4376)',
  sunrise: 'linear-gradient(135deg, #ff9a5a, #ffd86f)',
  mint: 'linear-gradient(135deg, #43c6ac, #b8f2e6)',
  rose: 'linear-gradient(135deg, #ee9ca7, #ffdde1)',
  slate: 'linear-gradient(135deg, #232526, #414345)',
  ocean: 'linear-gradient(135deg, #2193b0, #6dd5ed)',
};

// Gradient-mode picker also offers these bundled photos alongside CSS gradients.
export const GRADIENT_MODE_PHOTOS = [
  'green-flower',
  'orange-flower',
  'purple-flower',
  'purple-mood',
] as const;

// Curated art auto-switches by time of day (§6.3.3 + curated-art-time.ts) —
// each slot may have multiple variants; one is picked at random per load.
const CURATED_ART_BY_SLOT = {
  daytime: ['daytime'],
  sunset: ['sunset'],
  nighttime: ['nighttime'],
} as const;

// Weather-matched scenery (§6.3.4): 5 scenes, several bundled variants each.
// Snow has no dedicated asset yet — conditionCodeToScene already falls back
// snow codes to 'cloudy', so no 'snow' key is needed here.
const WEATHER_SCENE_FILES: Record<WeatherScene, string[]> = {
  sunny: ['sunny-1', 'sunny-2'],
  cloudy: ['cloudy-1'],
  rain: ['rain-1', 'rain-2'],
  evening: ['evening-1', 'evening-2'],
  night: ['clearnight-1', 'clearnight-2'],
};

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

export function gradientModePhotoUrl(id: string): string {
  return new URL(`../assets/gradients/${id}.webp`, import.meta.url).href;
}

function curatedArtUrl(id: string): string {
  return new URL(`../assets/curated-art/${id}.webp`, import.meta.url).href;
}

function weatherSceneUrl(id: string): string {
  return new URL(`../assets/weather-scenes/${id}.webp`, import.meta.url).href;
}

/** Applies the chosen background mode to #background-layer. Never issues a
 *  network request itself — gradients are inline CSS, photo blobs come from
 *  IndexedDB, and curated art / weather scenery are bundled local assets. */
export async function applyBackground(settings: BackgroundSettings): Promise<void> {
  const layer = document.getElementById('background-layer');
  if (!layer) return;

  switch (settings.mode) {
    case 'gradient': {
      const selected = settings.selectedId ?? 'default';
      if ((GRADIENT_MODE_PHOTOS as readonly string[]).includes(selected)) {
        layer.style.backgroundImage = `url(${gradientModePhotoUrl(selected)})`;
      } else {
        layer.style.backgroundImage = GRADIENTS[selected] ?? DEFAULT_GRADIENT;
      }
      break;
    }
    case 'weatherMatched': {
      const scene = (settings.selectedId as WeatherScene | null) ?? 'sunny';
      const variants = WEATHER_SCENE_FILES[scene] ?? WEATHER_SCENE_FILES.cloudy;
      layer.style.backgroundImage = `url(${weatherSceneUrl(pickRandom(variants))})`;
      break;
    }
    case 'curatedArt': {
      const slot = curatedArtSlotForHour(new Date().getHours());
      const variants = CURATED_ART_BY_SLOT[slot];
      layer.style.backgroundImage = `url(${curatedArtUrl(pickRandom(variants))})`;
      break;
    }
    case 'photo': {
      if (!settings.selectedId) {
        layer.style.backgroundImage = DEFAULT_GRADIENT;
        break;
      }

      // Imported lazily so the new tab page's first paint isn't held up by
      // opening IndexedDB when a non-photo mode is active (§12).
      const { createIndexedDbBackgroundRepo } = await import('@/db/background-repo');
      const photo = await createIndexedDbBackgroundRepo().get(settings.selectedId);

      if (!photo) {
        // The selected photo was deleted elsewhere — fall back rather than
        // rendering an empty layer.
        layer.style.backgroundImage = DEFAULT_GRADIENT;
        break;
      }

      // Object URLs are revoked on unload rather than immediately: the
      // browser needs the URL alive while it paints the background.
      const objectUrl = URL.createObjectURL(photo.blob);
      layer.style.backgroundImage = `url(${objectUrl})`;
      window.addEventListener('unload', () => URL.revokeObjectURL(objectUrl), { once: true });
      break;
    }
  }
}
