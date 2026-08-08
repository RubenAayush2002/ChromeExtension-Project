import { getFocus } from '@/lib/focus-store';
import { todaysTaskProgress } from '@/lib/focus-progress';
import { grantPass, setFocusModeActive } from '@/lib/focus-mode-store';
import { extractHostname } from '@/lib/url-normalize';
import { createIndexedDbTaskRepo } from '@/db/task-repo';

const taskRepo = createIndexedDbTaskRepo();

function getBlockedUrl(): string | null {
  return new URLSearchParams(window.location.search).get('url');
}

async function render() {
  const blockedUrl = getBlockedUrl();
  const hostname = blockedUrl ? extractHostname(blockedUrl) : null;
  document.getElementById('host')!.textContent = hostname ?? '';

  const [focusText, tasks] = await Promise.all([getFocus(chrome.storage.local, new Date()), taskRepo.all()]);
  document.getElementById('focus-text')!.textContent = focusText || 'No focus set for today.';

  const { done, total } = todaysTaskProgress(tasks);
  document.getElementById('progress')!.textContent = total > 0 ? `${done} of ${total} tasks done today` : '';
}

/** Leaves this page for `url`, or opens a fresh tab when there's nowhere to
 *  go back to. `chrome://newtab` can't be reached via window.location (Chrome
 *  blocks scripted navigation to chrome:// URLs), so that case needs the tabs
 *  API instead of an assignment that would silently do nothing. */
function leaveBlockedPage(url: string | null) {
  if (url) {
    window.location.href = url;
    return;
  }
  void chrome.tabs.create({});
  window.close();
}

document.getElementById('allow-5min')!.addEventListener('click', async () => {
  const blockedUrl = getBlockedUrl();
  const hostname = blockedUrl ? extractHostname(blockedUrl) : null;
  if (!blockedUrl || !hostname) return;

  // Awaited so the pass is durably in storage before we navigate — the
  // background's onBeforeNavigate check re-reads it, and racing the write
  // would bounce us straight back here.
  await grantPass(chrome.storage.local, hostname, Date.now());
  leaveBlockedPage(blockedUrl);
});

document.getElementById('turn-off-focus')!.addEventListener('click', async () => {
  await setFocusModeActive(chrome.storage.local, false);
  leaveBlockedPage(getBlockedUrl());
});

void render();
