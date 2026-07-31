import { vi } from 'vitest';

type Listener<T extends unknown[]> = (...args: T) => void;

function fakeEvent<T extends unknown[]>() {
  const listeners: Listener<T>[] = [];
  return {
    addListener: (fn: Listener<T>) => listeners.push(fn),
    removeListener: (fn: Listener<T>) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    hasListener: (fn: Listener<T>) => listeners.includes(fn),
    fire: (...args: T) => listeners.forEach((fn) => fn(...args)),
  };
}

/**
 * Minimal in-memory fake of the chrome.* surface this project touches
 * (storage.local, tabs, history, alarms, sessions). Scoped to Phase 1 needs —
 * extend as later phases need bookmarks/tabGroups/notifications/etc.
 */
export function createChromeFake() {
  const storageData: Record<string, unknown> = {};
  const alarmListeners = fakeEvent<[chrome.alarms.Alarm]>();
  const alarms = new Map<string, chrome.alarms.Alarm>();
  let tabsList: chrome.tabs.Tab[] = [];
  let historyList: chrome.history.HistoryItem[] = [];

  const fake = {
    storage: {
      local: {
        get: vi.fn((keys?: string | string[] | Record<string, unknown> | null) => {
          if (keys == null) return Promise.resolve({ ...storageData });
          if (typeof keys === 'string') {
            return Promise.resolve({ [keys]: storageData[keys] });
          }
          if (Array.isArray(keys)) {
            const out: Record<string, unknown> = {};
            for (const k of keys) out[k] = storageData[k];
            return Promise.resolve(out);
          }
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(keys)) {
            out[k] = k in storageData ? storageData[k] : (keys as Record<string, unknown>)[k];
          }
          return Promise.resolve(out);
        }),
        set: vi.fn((items: Record<string, unknown>) => {
          Object.assign(storageData, items);
          return Promise.resolve();
        }),
        remove: vi.fn((keys: string | string[]) => {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete storageData[k];
          return Promise.resolve();
        }),
        clear: vi.fn(() => {
          for (const k of Object.keys(storageData)) delete storageData[k];
          return Promise.resolve();
        }),
      },
    },
    alarms: {
      create: vi.fn((name: string, info: chrome.alarms.AlarmCreateInfo) => {
        alarms.set(name, { name, scheduledTime: Date.now() + (info.delayInMinutes ?? 0) * 60_000, periodInMinutes: info.periodInMinutes });
      }),
      clear: vi.fn((name: string) => {
        alarms.delete(name);
        return Promise.resolve(true);
      }),
      get: vi.fn((name: string) => Promise.resolve(alarms.get(name))),
      onAlarm: alarmListeners,
      /** Test helper: simulates the alarm firing, invoking all registered listeners. */
      __fire(name: string) {
        const alarm = alarms.get(name) ?? { name, scheduledTime: Date.now() };
        alarmListeners.fire(alarm);
      },
    },
    tabs: {
      query: vi.fn(() => Promise.resolve(tabsList)),
      /** Test helper: sets the fake open-tabs list. */
      __setTabs(tabs: chrome.tabs.Tab[]) {
        tabsList = tabs;
      },
    },
    history: {
      search: vi.fn(() => Promise.resolve(historyList)),
      /** Test helper: sets the fake history entries. */
      __setHistory(items: chrome.history.HistoryItem[]) {
        historyList = items;
      },
    },
    sessions: {
      getRecentlyClosed: vi.fn(() => Promise.resolve([])),
    },
    notifications: {
      create: vi.fn(),
    },
  };

  return fake;
}

export type ChromeFake = ReturnType<typeof createChromeFake>;
