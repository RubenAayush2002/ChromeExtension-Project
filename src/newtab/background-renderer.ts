import type { BackgroundSettings } from '@/lib/background-store';
import type { WeatherScene } from '@/lib/weather-lookup';
import { curatedArtSlotForHour } from '@/lib/curated-art-time';

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #6d83f2, #a480f2)';

const GRADIENTS: Record<string, string> = {
  default: DEFAULT_GRADIENT,
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

function gradientModePhotoUrl(id: string): string {
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
      // User photo uploads are stored as Blobs in IndexedDB; rendering wires
      // up an object URL from the selected record once the gallery UI lands.
      layer.style.backgroundImage = DEFAULT_GRADIENT;
      break;
    }
  }
}
