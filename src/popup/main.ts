import { planTabGroupsByHostname } from '@/lib/tab-tidy';
import { findDuplicateTabIds } from '@/lib/duplicate-tabs';
import { saveTabSet, deleteTabSet, type SavedTabSet } from '@/lib/tab-set-store';
import { createIndexedDbTabSetRepo } from '@/db/tab-set-repo';
import { saveForLater } from '@/lib/read-later-store';
import { createIndexedDbReadLaterRepo } from '@/db/read-later-repo';
import { extractFromTab } from '@/lib/page-extract-client';

const tabSetRepo = createIndexedDbTabSetRepo();
const readLaterRepo = createIndexedDbReadLaterRepo();
const statusEl = document.getElementById('status') as HTMLParagraphElement;

function showStatus(message: string) {
  statusEl.hidden = false;
  statusEl.textContent = message;
  window.setTimeout(() => {
    statusEl.hidden = true;
  }, 2500);
}

async function getCurrentWindowTabs() {
  return chrome.tabs.query({ currentWindow: true });
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function tidyTabs() {
  const tabs = await getCurrentWindowTabs();
  const tidyable = tabs.filter((t): t is chrome.tabs.Tab & { id: number; url: string } => !!t.id && !!t.url);
  const plans = planTabGroupsByHostname(tidyable);

  for (const plan of plans) {
    const groupId = await chrome.tabs.group({ tabIds: plan.tabIds });
    await chrome.tabGroups.update(groupId, { title: plan.hostname, color: plan.color });
  }

  showStatus(plans.length > 0 ? `Grouped tabs into ${plans.length} group(s).` : 'Nothing to group.');
}

async function closeDuplicates() {
  const tabs = await getCurrentWindowTabs();
  const closable = tabs.filter((t): t is chrome.tabs.Tab & { id: number; url: string } => !!t.id && !!t.url);
  const duplicateIds = findDuplicateTabIds(closable);

  if (duplicateIds.length > 0) {
    await chrome.tabs.remove(duplicateIds);
  }
  showStatus(duplicateIds.length > 0 ? `Closed ${duplicateIds.length} duplicate tab(s).` : 'No duplicates found.');
}

function openBookmarksPanel() {
  chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks-panel/index.html') });
}

async function saveCurrentTabsAsSet() {
  const tabs = await getCurrentWindowTabs();
  const urls = tabs.map((t) => t.url).filter((url): url is string => !!url);
  if (urls.length === 0) return;

  const name = window.prompt('Name this tab set:', `Tab set (${urls.length} tabs)`);
  if (!name) return;

  await saveTabSet(tabSetRepo, name, urls, Date.now());
  showStatus('Tab set saved.');
  void renderTabSets();
}

async function reopenTabSet(set: SavedTabSet) {
  const win = await chrome.windows.create({ url: set.urls[0] });
  for (const url of set.urls.slice(1)) {
    await chrome.tabs.create({ windowId: win.id, url });
  }
}

async function removeTabSet(id: string) {
  await deleteTabSet(tabSetRepo, id);
  void renderTabSets();
}

async function renderTabSets() {
  const list = document.getElementById('tab-set-list')!;
  const sets = await tabSetRepo.all();
  list.innerHTML = '';

  for (const set of sets.sort((a, b) => b.createdAt - a.createdAt)) {
    const li = document.createElement('li');
    li.className = 'tab-set-row';

    const name = document.createElement('span');
    name.className = 'tab-set-name';
    name.textContent = `${set.name} (${set.urls.length})`;
    name.addEventListener('click', () => void reopenTabSet(set));

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete this set';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void removeTabSet(set.id);
    });

    li.append(name, deleteBtn);
    list.append(li);
  }
}

async function saveCurrentPageForLater() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) return;

  const result = await extractFromTab(tab.id);
  const preview = result?.openingLines ?? 'No preview available for this page.';
  const isFallback = !result?.openingLines;

  await saveForLater(readLaterRepo, tab.url, tab.title ?? tab.url, preview, Date.now(), isFallback);
  showStatus('Saved for later.');
}

async function openReadingViewForActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  chrome.tabs.create({ url: chrome.runtime.getURL(`reading-view/index.html?tabId=${tab.id}`) });
}

document.getElementById('tidy-tabs')!.addEventListener('click', () => void tidyTabs());
document.getElementById('close-duplicates')!.addEventListener('click', () => void closeDuplicates());
document.getElementById('open-bookmarks')!.addEventListener('click', openBookmarksPanel);
document.getElementById('save-tab-set')!.addEventListener('click', () => void saveCurrentTabsAsSet());
document.getElementById('save-read-later')!.addEventListener('click', () => void saveCurrentPageForLater());
document.getElementById('open-reading-view')!.addEventListener('click', () => void openReadingViewForActiveTab());

void renderTabSets();
