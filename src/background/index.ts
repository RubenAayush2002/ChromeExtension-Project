import { FOCUS_MIDNIGHT_ALARM, resetFocusForNewDay } from '@/lib/focus-store';
import { TASK_PURGE_ALARM, purgeOldCompletedTasks } from '@/lib/task-store';
import { createIndexedDbTaskRepo } from '@/db/task-repo';
import { shouldNotify, recordNotified, recordBelowThreshold } from '@/lib/tab-limit-nudge';
import { getTabLimitThreshold, getNudgeState, setNudgeState } from '@/lib/tab-limit-settings';
import { getFocusModeState, shouldBlockNavigation, pruneExpiredPasses } from '@/lib/focus-mode-store';
import { extractHostname } from '@/lib/url-normalize';
import { fetchWeather } from '@/lib/weather-store';
import { fetchWeatherFromOpenWeatherMap } from '@/newtab/weather-fetcher';
import { planTabGroupsByHostname } from '@/lib/tab-tidy';
import { findDuplicateTabIds } from '@/lib/duplicate-tabs';
import { saveForLater } from '@/lib/read-later-store';
import { createIndexedDbReadLaterRepo } from '@/db/read-later-repo';
import { createGroqProvider } from '@/lib/groq-provider';
import { createIndexedDbWordLookupCache } from '@/db/word-lookup-repo';
import { extractFromTab } from '@/lib/page-extract-client';
import type { AiOnlyResult } from '@/lib/smart-call';
import {
  explainText,
  explainTextSimpler,
  lookupWord,
  askAcrossTabs,
  type TabContent,
} from '@/lib/ai-only-features';

const WEATHER_REFRESH_ALARM = 'weather-refresh';
const FOCUS_MODE_PASS_SWEEP_ALARM = 'focus-mode-pass-sweep';

async function checkFocusModeNavigation(tabId: number, url: string) {
  // Never bounce the extension's own pages — the Blocked page itself would
  // otherwise be a redirect target, and its "allow 5 minutes" hand-off back to
  // the blocked site could loop.
  if (url.startsWith(chrome.runtime.getURL(''))) return;

  const hostname = extractHostname(url);
  if (!hostname) return;

  const state = await getFocusModeState(chrome.storage.local);
  if (!shouldBlockNavigation(state, hostname, Date.now())) return;

  const blockedPageUrl = chrome.runtime.getURL(`blocked/index.html?url=${encodeURIComponent(url)}`);
  await chrome.tabs.update(tabId, { url: blockedPageUrl });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return; // only top-level frame navigations
  void checkFocusModeNavigation(details.tabId, details.url);
});

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
  chrome.alarms.create(FOCUS_MODE_PASS_SWEEP_ALARM, { periodInMinutes: 5 });
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
    await fetchWeather(chrome.storage.local, fetchWeatherFromOpenWeatherMap);
  }

  if (alarm.name === FOCUS_MODE_PASS_SWEEP_ALARM) {
    await pruneExpiredPasses(chrome.storage.local, now.getTime());
  }
});

interface EdgeTabMessage {
  type:
    | 'open-reading-view'
    | 'bookmark-page'
    | 'tidy-tabs'
    | 'close-duplicates'
    | 'take-screenshot'
    | 'save-read-later';
  title?: string;
  url?: string;
  preview?: string;
  previewIsFallback?: boolean;
}

async function handleEdgeTabMessage(message: EdgeTabMessage, senderTabId: number | undefined) {
  switch (message.type) {
    case 'open-reading-view': {
      if (!senderTabId) return;
      await chrome.tabs.create({ url: chrome.runtime.getURL(`reading-view/index.html?tabId=${senderTabId}`) });
      return;
    }
    case 'bookmark-page': {
      if (!message.url) return;
      await chrome.bookmarks.create({ title: message.title ?? message.url, url: message.url });
      return;
    }
    case 'tidy-tabs': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tidyable = tabs.filter((t): t is chrome.tabs.Tab & { id: number; url: string } => !!t.id && !!t.url);
      const plans = planTabGroupsByHostname(tidyable);
      for (const plan of plans) {
        const groupId = await chrome.tabs.group({ tabIds: plan.tabIds });
        await chrome.tabGroups.update(groupId, { title: plan.hostname, color: plan.color });
      }
      return;
    }
    case 'close-duplicates': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const closable = tabs.filter((t): t is chrome.tabs.Tab & { id: number; url: string } => !!t.id && !!t.url);
      const duplicateIds = findDuplicateTabIds(closable);
      if (duplicateIds.length > 0) await chrome.tabs.remove(duplicateIds);
      return;
    }
    case 'save-read-later': {
      // Persisted here rather than in the content script so the item lands in
      // the extension's own IndexedDB origin, where the popup can read it.
      if (!message.url) return;
      await saveForLater(
        createIndexedDbReadLaterRepo(),
        message.url,
        message.title ?? message.url,
        message.preview ?? 'No preview available for this page.',
        Date.now(),
        message.previewIsFallback ?? false,
      );
      return;
    }
    case 'take-screenshot': {
      if (!senderTabId) return;
      const tab = await chrome.tabs.get(senderTabId);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      await chrome.storage.local.set({ pendingScreenshot: dataUrl });
      await chrome.tabs.create({ url: chrome.runtime.getURL('screenshot/index.html') });
      return;
    }
  }
}

const EDGE_TAB_MESSAGE_TYPES = new Set<string>([
  'open-reading-view',
  'bookmark-page',
  'tidy-tabs',
  'close-duplicates',
  'take-screenshot',
  'save-read-later',
]);

// Chrome dispatches every message to every listener. This one must ignore
// anything that isn't its own and return false: returning undefined for an
// AI message would signal "not responding asynchronously" and can close the
// channel before the AI listener below calls sendResponse — leaving the
// caller's sendMessage promise pending forever.
chrome.runtime.onMessage.addListener((message: EdgeTabMessage, sender) => {
  if (!EDGE_TAB_MESSAGE_TYPES.has(message.type)) return false;

  void handleEdgeTabMessage(message, sender.tab?.id);
  return false;
});

interface AiMessage {
  type: 'ai-explain' | 'ai-explain-simpler' | 'ai-word-lookup' | 'ai-ask-tabs';
  text?: string;
  previous?: string;
  word?: string;
  sentence?: string;
  question?: string;
}

const AI_MESSAGE_TYPES = new Set<string>([
  'ai-explain',
  'ai-explain-simpler',
  'ai-word-lookup',
  'ai-ask-tabs',
]);

/** The §10.3 features run here rather than in the content script so the API
 *  key is never read into a page-hosted context. Returns the AiOnlyResult
 *  shape, which already distinguishes "layer is off" from "call failed". */
async function handleAiMessage(message: AiMessage): Promise<AiOnlyResult> {
  const provider = createGroqProvider();

  switch (message.type) {
    case 'ai-explain':
      return explainText(chrome.storage.local, provider, message.text ?? '');

    case 'ai-explain-simpler':
      return explainTextSimpler(chrome.storage.local, provider, message.text ?? '', message.previous ?? '');

    case 'ai-word-lookup':
      return lookupWord(
        chrome.storage.local,
        provider,
        createIndexedDbWordLookupCache(),
        message.word ?? '',
        message.sentence ?? '',
      );

    case 'ai-ask-tabs':
      return askAcrossTabsFromOpenTabs(provider, message.question ?? '');
  }
}

/** Flattens extracted article HTML to plain text.
 *
 *  Regex rather than DOMParser: service workers have no DOM, so the popup's
 *  DOMParser-based version can't be reused here. Scripts and styles are
 *  dropped first so their contents don't leak into the text. */
function articlePlainText(contentHtml: string | undefined): string {
  if (!contentHtml) return '';
  return contentHtml
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gathers text from every readable open tab, then asks the question across
 *  them. Tabs that can't be scripted (chrome:// pages, the web store) are
 *  skipped rather than failing the whole request. */
async function askAcrossTabsFromOpenTabs(
  provider: ReturnType<typeof createGroqProvider>,
  question: string,
): Promise<AiOnlyResult> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const contents: TabContent[] = [];

  for (const tab of tabs) {
    if (!tab.id || !tab.url?.startsWith('http')) continue;
    try {
      const extracted = await extractFromTab(tab.id);
      // Prefer the full article body — openingLines is just the first
      // paragraph, which is far too thin to answer questions from, and is
      // null on pages without a clear <p>. Fall back to the title so a tab
      // is still represented rather than silently dropped.
      const text =
        articlePlainText(extracted?.article?.contentHtml) ||
        extracted?.openingLines ||
        tab.title ||
        '';
      if (text) contents.push({ title: tab.title ?? tab.url, url: tab.url, text });
    } catch {
      // Unscriptable tab — skip it and keep going.
    }
  }

  return askAcrossTabs(chrome.storage.local, provider, question, contents);
}

// Separate listener from the edge-tab one above: these need to send a response
// back, which requires returning true to keep the channel open.
chrome.runtime.onMessage.addListener((message: AiMessage, _sender, sendResponse) => {
  if (!AI_MESSAGE_TYPES.has(message.type)) return false;

  handleAiMessage(message).then(sendResponse, (error: unknown) =>
    sendResponse({
      ok: false,
      reason: 'failed',
      message: error instanceof Error ? error.message : "Couldn't complete this right now.",
    }),
  );
  return true;
});
