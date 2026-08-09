import { getSettings, setSettings } from '@/newtab/settings';
import { getTheme, setTheme } from '@/newtab/theme';
import {
  getBackgroundSettings,
  setBackgroundSettings,
  type BackgroundMode,
  type BackgroundSettings,
} from '@/lib/background-store';
import { GRADIENTS, GRADIENT_MODE_PHOTOS, gradientModePhotoUrl } from '@/newtab/background-renderer';
import { createIndexedDbBackgroundRepo } from '@/db/background-repo';
import { addPhoto, deletePhoto } from '@/lib/background-upload';
import { getTabLimitThreshold, setTabLimitThreshold } from '@/lib/tab-limit-settings';
import { getFocusModeState, setFocusModeActive, setBlocklist } from '@/lib/focus-mode-store';
import {
  getSmartLayerSettings,
  setApiKey,
  setKeyVerified,
  setSmartLayerEnabled,
  maskApiKey,
} from '@/lib/smart-layer-store';
import { testApiKey } from '@/lib/smart-call';
import { createGroqProvider } from '@/lib/groq-provider';

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
  const [settings, theme, background, weather, tabLimit, focusMode, smartLayer] = await Promise.all([
    getSettings(),
    getTheme(),
    getBackgroundSettings(chrome.storage.local),
    getWeatherSettings(),
    getTabLimitThreshold(chrome.storage.local),
    getFocusModeState(chrome.storage.local),
    getSmartLayerSettings(chrome.storage.local),
  ]);

  el<HTMLInputElement>('name').value = settings.name;
  el<HTMLSelectElement>('search-engine').value = settings.searchEngine;

  el<HTMLSelectElement>('theme-mode').value = theme.mode;
  el<HTMLSelectElement>('theme-auto-basis').value = theme.autoBasis;
  el<HTMLInputElement>('theme-start-hour').value = String(theme.timeRange?.start ?? 20);
  el<HTMLInputElement>('theme-end-hour').value = String(theme.timeRange?.end ?? 6);

  el<HTMLInputElement>('weather-city').value = weather.city;
  el<HTMLInputElement>('weather-api-key').value = weather.apiKey;

  el<HTMLSelectElement>('background-mode').value = background.mode;
  await renderBackgroundPicker(background);

  el<HTMLInputElement>('tab-limit').value = String(tabLimit);

  el<HTMLInputElement>('focus-mode-active').checked = focusMode.active;
  el<HTMLTextAreaElement>('focus-blocklist').value = focusMode.blocklist.join('\n');

  // The stored key is never written back into the input — the field stays
  // empty and the masked form is shown beside it, so a saved key can't be
  // read off the screen. Typing a new value replaces it (§10.1).
  el<HTMLInputElement>('groq-api-key').value = '';
  renderKeyMask(smartLayer.apiKey);
  el<HTMLInputElement>('smart-layer-enabled').checked = smartLayer.enabled;

  // First run: no key saved yet, so open the walkthrough by default.
  el<HTMLDetailsElement>('smart-walkthrough').open = !smartLayer.apiKey;

  updateSmartLayerAvailability(smartLayer.apiKey);
  updateVisibility();
}

const backgroundRepo = createIndexedDbBackgroundRepo();

/** Object URLs created for gallery thumbnails. Revoked before each re-render
 *  so repeated renders don't leak blob URLs for the page's lifetime. */
let galleryObjectUrls: string[] = [];

function releaseGalleryUrls() {
  for (const url of galleryObjectUrls) URL.revokeObjectURL(url);
  galleryObjectUrls = [];
}

/** Applies a background choice immediately — the picker has no separate Save
 *  step, so a click is the commit. */
async function chooseBackground(mode: BackgroundMode, selectedId: string | null) {
  await setBackgroundSettings(chrome.storage.local, { mode, selectedId });
  await renderBackgroundPicker({ mode, selectedId });
}

async function renderBackgroundPicker(settings: BackgroundSettings) {
  const mode = settings.mode;
  el<HTMLElement>('gradient-picker').hidden = mode !== 'gradient';
  el<HTMLElement>('photo-picker').hidden = mode !== 'photo';

  const note = el<HTMLParagraphElement>('background-note');
  const noteText: Partial<Record<BackgroundMode, string>> = {
    curatedArt: 'Curated art switches automatically between daytime, sunset and nighttime images.',
    weatherMatched: 'The background follows current conditions. Set a weather city above for this to work.',
  };
  note.hidden = !noteText[mode];
  note.textContent = noteText[mode] ?? '';

  if (mode === 'gradient') renderGradientSwatches(settings.selectedId);
  if (mode === 'photo') await renderPhotoGallery(settings.selectedId);
}

function renderGradientSwatches(selectedId: string | null) {
  const grid = el<HTMLElement>('gradient-picker');
  grid.innerHTML = '';
  const active = selectedId ?? 'default';

  for (const [id, css] of Object.entries(GRADIENTS)) {
    grid.append(
      createSwatch({
        style: css,
        label: id,
        selected: id === active,
        onSelect: () => void chooseBackground('gradient', id),
      }),
    );
  }

  // Bundled mood photos sit in the same picker as the CSS gradients (§6.3.1).
  for (const id of GRADIENT_MODE_PHOTOS) {
    grid.append(
      createSwatch({
        style: `url(${gradientModePhotoUrl(id)})`,
        label: id.replace(/-/g, ' '),
        selected: id === active,
        onSelect: () => void chooseBackground('gradient', id),
      }),
    );
  }
}

async function renderPhotoGallery(selectedId: string | null) {
  releaseGalleryUrls();
  const grid = el<HTMLElement>('photo-gallery');
  grid.innerHTML = '';

  const photos = (await backgroundRepo.all()).sort((a, b) => b.addedAt - a.addedAt);
  el<HTMLParagraphElement>('photo-empty').hidden = photos.length > 0;

  for (const photo of photos) {
    const objectUrl = URL.createObjectURL(photo.blob);
    galleryObjectUrls.push(objectUrl);

    grid.append(
      createSwatch({
        style: `url(${objectUrl})`,
        label: photo.name,
        selected: photo.id === selectedId,
        onSelect: () => void chooseBackground('photo', photo.id),
        onDelete: async () => {
          const { nextSelectedId } = await deletePhoto(backgroundRepo, photo.id, selectedId);
          await chooseBackground(nextSelectedId ? 'photo' : 'gradient', nextSelectedId);
        },
      }),
    );
  }
}

function createSwatch(options: {
  style: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = options.selected ? 'swatch selected' : 'swatch';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'swatch-preview';
  button.style.backgroundImage = options.style;
  button.title = options.label;
  button.setAttribute('aria-label', options.label);
  button.addEventListener('click', options.onSelect);
  wrapper.append(button);

  if (options.onDelete) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'swatch-delete';
    remove.textContent = '✕';
    remove.title = `Delete ${options.label}`;
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onDelete!();
    });
    wrapper.append(remove);
  }

  return wrapper;
}

async function handlePhotoUpload(input: HTMLInputElement) {
  const file = input.files?.[0];
  if (!file) return;

  const errorEl = el<HTMLParagraphElement>('photo-error');
  const result = await addPhoto(backgroundRepo, file);
  input.value = ''; // let the same file be re-picked after a failure

  if (!result.ok) {
    errorEl.hidden = false;
    errorEl.textContent = result.message;
    return;
  }

  errorEl.hidden = true;
  await chooseBackground('photo', result.photo.id);
}

function renderKeyMask(apiKey: string) {
  const masked = el<HTMLParagraphElement>('groq-key-masked');
  masked.hidden = !apiKey;
  masked.textContent = apiKey ? `Saved key: ${maskApiKey(apiKey)}` : '';
}

/** §10.1: the master toggle is disabled until a key exists, with an inline
 *  note pointing at the field above it. */
function updateSmartLayerAvailability(apiKey: string) {
  const toggle = el<HTMLInputElement>('smart-layer-enabled');
  const note = el<HTMLParagraphElement>('smart-layer-note');

  toggle.disabled = !apiKey;
  note.hidden = !!apiKey;
  note.textContent = apiKey ? '' : 'Add an API key above to turn this on.';
}

function showKeyStatus(message: string, ok: boolean) {
  const status = el<HTMLSpanElement>('groq-key-status');
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle('ok', ok);
  status.classList.toggle('bad', !ok);
}

/** Tests whatever key is in play: a freshly typed one if present, otherwise
 *  the already-saved key. A passing test is recorded so the toggle can be
 *  enabled without re-testing. */
async function handleTestKey() {
  const typed = el<HTMLInputElement>('groq-api-key').value.trim();
  const stored = await getSmartLayerSettings(chrome.storage.local);
  const keyToTest = typed || stored.apiKey;

  showKeyStatus('Testing…', true);
  const result = await testApiKey(createGroqProvider(), keyToTest);
  showKeyStatus(result.message, result.ok);

  if (result.ok) {
    // Persist the tested key immediately so a pass isn't lost if the user
    // never presses Save.
    if (typed) {
      await setApiKey(chrome.storage.local, typed);
      el<HTMLInputElement>('groq-api-key').value = '';
      renderKeyMask(typed);
    }
    await setKeyVerified(chrome.storage.local, true);
    updateSmartLayerAvailability(keyToTest);
  }
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

  // Background is committed by the picker itself, not by Save — a swatch
  // click is the commit, so there is nothing to persist here.

  const tabLimit = Number(el<HTMLInputElement>('tab-limit').value);
  if (tabLimit > 0) {
    await setTabLimitThreshold(chrome.storage.local, tabLimit);
  }

  const blocklist = el<HTMLTextAreaElement>('focus-blocklist')
    .value.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  await setBlocklist(chrome.storage.local, blocklist);
  await setFocusModeActive(chrome.storage.local, el<HTMLInputElement>('focus-mode-active').checked);

  // Only overwrite the stored key when something new was typed — an empty
  // field means "keep the existing key", not "clear it".
  const typedKey = el<HTMLInputElement>('groq-api-key').value.trim();
  if (typedKey) {
    await setApiKey(chrome.storage.local, typedKey);
    el<HTMLInputElement>('groq-api-key').value = '';
    renderKeyMask(typedKey);
  }

  // setSmartLayerEnabled refuses to enable without a key; reflect whatever
  // state actually took effect rather than assuming the checkbox won.
  await setSmartLayerEnabled(chrome.storage.local, el<HTMLInputElement>('smart-layer-enabled').checked);
  const smartLayer = await getSmartLayerSettings(chrome.storage.local);
  el<HTMLInputElement>('smart-layer-enabled').checked = smartLayer.enabled;
  updateSmartLayerAvailability(smartLayer.apiKey);

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
el<HTMLButtonElement>('test-groq-key').addEventListener('click', () => void handleTestKey());

el<HTMLSelectElement>('background-mode').addEventListener('change', (event) => {
  const mode = (event.target as HTMLSelectElement).value as BackgroundMode;
  // Switching mode clears the previous mode's selection; each mode picks its
  // own default (gradient/photo re-select below, the other two are automatic).
  void chooseBackground(mode, null);
});

el<HTMLInputElement>('photo-upload').addEventListener('change', (event) =>
  void handlePhotoUpload(event.target as HTMLInputElement),
);

// A key typed but not yet saved should still un-gate the toggle.
el<HTMLInputElement>('groq-api-key').addEventListener('input', async () => {
  const typed = el<HTMLInputElement>('groq-api-key').value.trim();
  const stored = await getSmartLayerSettings(chrome.storage.local);
  updateSmartLayerAvailability(typed || stored.apiKey);
});

void loadForm();
