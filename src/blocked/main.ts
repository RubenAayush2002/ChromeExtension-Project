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

document.getElementById('allow-5min')!.addEventListener('click', async () => {
  const hostname = getBlockedUrl() ? extractHostname(getBlockedUrl()!) : null;
  if (!hostname) return;

  await grantPass(chrome.storage.local, hostname, Date.now());
  window.location.href = getBlockedUrl()!;
});

document.getElementById('turn-off-focus')!.addEventListener('click', async () => {
  await setFocusModeActive(chrome.storage.local, false);
  const blockedUrl = getBlockedUrl();
  // Always leave this page — if we don't know which site was originally
  // blocked (e.g. this page was opened directly, with no ?url= param),
  // land on the new tab page instead of doing nothing.
  window.location.href = blockedUrl ?? 'chrome://newtab';
});

void render();
