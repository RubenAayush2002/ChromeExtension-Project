import { greetingText } from '@/lib/greeting';
import { getFocus, setFocus } from '@/lib/focus-store';
import { createIndexedDbTaskRepo } from '@/db/task-repo';
import { buildSuggestions, moveSelection, type SearchSuggestion } from '@/lib/instant-search';
import { fetchWeather, formatLastUpdated } from '@/lib/weather-store';
import { celsiusToFahrenheit, adviceForScene } from '@/lib/weather-lookup';
import { fetchWeatherFromOpenWeatherMap } from './weather-fetcher';
import { getBackgroundSettings } from '@/lib/background-store';
import { applyBackground } from './background-renderer';
import { getTheme, applyTheme } from './theme';
import { getSettings } from './settings';
import { initFocusModeOverlay } from './focus-mode-overlay';
import { initTasksBox } from './tasks-box';

const taskRepo = createIndexedDbTaskRepo();

async function initGreetingAndClock() {
  const settings = await getSettings();
  const greetingEl = document.getElementById('greeting')!;
  const dateEl = document.getElementById('date')!;
  const clockEl = document.getElementById('clock')!;

  function tick() {
    const now = new Date();
    greetingEl.textContent = greetingText(now.getHours(), settings.name);
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    clockEl.textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  tick();
  setInterval(tick, 1000);
}

async function initFocus() {
  const input = document.getElementById('focus-input') as HTMLInputElement;
  const now = new Date();
  input.value = await getFocus(chrome.storage.local, now);

  let debounceHandle: number | undefined;
  input.addEventListener('input', () => {
    window.clearTimeout(debounceHandle);
    debounceHandle = window.setTimeout(() => {
      void setFocus(chrome.storage.local, input.value, new Date());
    }, 300);
  });
}


async function initSearch() {
  const input = document.getElementById('search-input') as HTMLInputElement;
  const list = document.getElementById('search-suggestions') as HTMLUListElement;
  const settings = await getSettings();
  let suggestions: SearchSuggestion[] = [];
  let selectedIndex = -1;

  function render() {
    list.innerHTML = '';
    if (suggestions.length === 0) {
      list.hidden = true;
      return;
    }
    list.hidden = false;
    suggestions.forEach((s, i) => {
      const li = document.createElement('li');
      li.setAttribute('aria-selected', String(i === selectedIndex));
      li.innerHTML = `<span>${s.title}</span><span class="muted">${s.kind}</span>`;
      li.addEventListener('click', () => activate(s));
      list.append(li);
    });
  }

  function activate(suggestion: SearchSuggestion) {
    if (suggestion.kind === 'tab' && suggestion.tabId != null) {
      chrome.tabs.update(suggestion.tabId, { active: true });
    } else {
      window.location.href = suggestion.url;
    }
  }

  function searchEngineUrl(query: string): string {
    const engines: Record<string, string> = {
      google: 'https://www.google.com/search?q=',
      duckduckgo: 'https://duckduckgo.com/?q=',
      bing: 'https://www.bing.com/search?q=',
    };
    return (engines[settings.searchEngine] ?? engines.google) + encodeURIComponent(query);
  }

  function looksLikeUrl(text: string): boolean {
    if (/^https?:\/\//i.test(text)) return true;
    return /^[^\s/]+\.[^\s/]{2,}(\/\S*)?$/.test(text) && !text.includes(' ');
  }

  input.addEventListener('input', async () => {
    const query = input.value;
    selectedIndex = -1;
    if (!query.trim()) {
      suggestions = [];
      render();
      return;
    }
    const [tabs, history] = await Promise.all([
      chrome.tabs.query({}),
      chrome.history.search({ text: query, maxResults: 10, startTime: 0 }),
    ]);
    suggestions = buildSuggestions(query, { tabs, history });
    render();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = moveSelection(selectedIndex, 'down', suggestions.length);
      render();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = moveSelection(selectedIndex, 'up', suggestions.length);
      render();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const query = input.value.trim();
      const selected = selectedIndex !== -1 ? suggestions[selectedIndex] : undefined;
      if (selected) {
        activate(selected);
      } else if (looksLikeUrl(query)) {
        window.location.href = /^https?:\/\//i.test(query) ? query : `https://${query}`;
      } else if (query) {
        window.location.href = searchEngineUrl(query);
      }
    }
  });
}

async function initWeather() {
  const corner = document.getElementById('weather-corner')!;
  const tempEl = document.getElementById('weather-temp')!;
  const placeEl = document.getElementById('weather-place')!;
  const adviceEl = document.getElementById('weather-advice')!;
  const updatedEl = document.getElementById('weather-updated')!;

  const result = await fetchWeather(chrome.storage.local, fetchWeatherFromOpenWeatherMap);
  if (!result.reading) {
    corner.hidden = true;
    return;
  }

  corner.hidden = false;
  let showFahrenheit = false;

  function render() {
    const reading = result.reading!;
    const temp = showFahrenheit ? celsiusToFahrenheit(reading.tempC) : Math.round(reading.tempC);
    tempEl.textContent = `${temp}°${showFahrenheit ? 'F' : 'C'}`;
    placeEl.textContent = reading.place;
    adviceEl.textContent = adviceForScene(reading.scene);
    if (result.stale) {
      updatedEl.hidden = false;
      updatedEl.textContent = `Last updated ${formatLastUpdated(reading.fetchedAt, Date.now())}`;
    } else {
      updatedEl.hidden = true;
    }
  }

  tempEl.addEventListener('click', () => {
    showFahrenheit = !showFahrenheit;
    render();
  });

  render();

  if (result.reading && (await getBackgroundSettings(chrome.storage.local)).mode === 'weatherMatched') {
    applyBackground({ mode: 'weatherMatched', selectedId: result.reading.scene });
  }
}

async function initBackground() {
  const settings = await getBackgroundSettings(chrome.storage.local);
  await applyBackground(settings);
}

async function initBookmarksIcon() {
  document.getElementById('bookmarks-icon')!.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks-panel/index.html') });
  });
}

async function initRecentlyClosed() {
  const footer = document.getElementById('recently-closed')!;
  const list = document.getElementById('recently-closed-list')!;
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 8 });
  const closedTabs = sessions.filter((s) => s.tab).map((s) => s.tab!);

  if (closedTabs.length === 0) {
    footer.hidden = true;
    return;
  }
  footer.hidden = false;

  for (const tab of closedTabs) {
    const button = document.createElement('button');
    button.textContent = tab.title || tab.url || 'Closed tab';
    button.addEventListener('click', () => chrome.sessions.restore(tab.sessionId));
    list.append(button);
  }
}

async function main() {
  const theme = await getTheme();
  applyTheme(theme);

  const focusModeActive = await initFocusModeOverlay(document, chrome.storage.local, taskRepo, () =>
    window.location.reload(),
  );
  if (focusModeActive) return;

  await Promise.all([
    initGreetingAndClock(),
    initFocus(),
    initTasksBox(document, taskRepo),
    initSearch(),
    initWeather(),
    initBackground(),
    initBookmarksIcon(),
    initRecentlyClosed(),
  ]);
}

void main();
