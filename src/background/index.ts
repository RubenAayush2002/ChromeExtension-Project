import { FOCUS_MIDNIGHT_ALARM, resetFocusForNewDay } from '@/lib/focus-store';
import { TASK_PURGE_ALARM, purgeOldCompletedTasks } from '@/lib/task-store';
import { createIndexedDbTaskRepo } from '@/db/task-repo';
import { shouldNotify, recordNotified, recordBelowThreshold } from '@/lib/tab-limit-nudge';
import { getTabLimitThreshold, getNudgeState, setNudgeState } from '@/lib/tab-limit-settings';

const WEATHER_REFRESH_ALARM = 'weather-refresh';

async function checkTabLimitNudge() {
  const [tabs, threshold, state] = await Promise.all([
    chrome.tabs.query({}),
    getTabLimitThreshold(chrome.storage.local),
    getNudgeState(chrome.storage.local),
  ]);

  const count = tabs.length;

  if (count < threshold) {
    if (state.lastNotifiedAtCount !== null) {
      await setNudgeState(chrome.storage.local, recordBelowThreshold());
    }
    return;
  }

  if (shouldNotify(count, threshold, state)) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Too many tabs open',
      message: `You have ${count} tabs open — might be a good time to tidy up.`,
    });
    await setNudgeState(chrome.storage.local, recordNotified(count));
  }
}

chrome.tabs.onCreated.addListener(() => void checkTabLimitNudge());
chrome.tabs.onRemoved.addListener(() => void checkTabLimitNudge());

function msUntilNextMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(FOCUS_MIDNIGHT_ALARM, {
    delayInMinutes: msUntilNextMidnight(new Date()) / 60_000,
    periodInMinutes: 24 * 60,
  });
  chrome.alarms.create(TASK_PURGE_ALARM, { periodInMinutes: 24 * 60 });
  chrome.alarms.create(WEATHER_REFRESH_ALARM, { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const now = new Date();

  if (alarm.name === FOCUS_MIDNIGHT_ALARM) {
    await resetFocusForNewDay(chrome.storage.local, now);
  }

  if (alarm.name === TASK_PURGE_ALARM) {
    const repo = createIndexedDbTaskRepo();
    await purgeOldCompletedTasks(repo, now.getTime());
  }

  if (alarm.name === WEATHER_REFRESH_ALARM) {
    // The new tab page fetches weather on open; this alarm exists so a
    // long-lived tab (or the next new tab) always sees a reasonably fresh
    // cached reading rather than one from hours ago.
    const { fetchWeather } = await import('@/lib/weather-store');
    const { fetchWeatherFromOpenWeatherMap } = await import('@/newtab/weather-fetcher');
    await fetchWeather(chrome.storage.local, fetchWeatherFromOpenWeatherMap);
  }
});
