import type { LocalStorage } from '@/lib/storage-types';
import type { TaskRepo } from '@/lib/task-store';
import { getFocusModeState, setFocusModeActive } from '@/lib/focus-mode-store';
import { getFocus } from '@/lib/focus-store';
import { todaysTaskProgress } from '@/lib/focus-progress';

export interface FocusModeOverlayElements {
  page: HTMLElement;
  overlay: HTMLElement;
  focusText: HTMLElement;
  progress: HTMLElement;
  offButton: HTMLElement;
}

export function getFocusModeOverlayElements(doc: Document): FocusModeOverlayElements {
  return {
    page: doc.getElementById('page')!,
    overlay: doc.getElementById('focus-mode-overlay')!,
    focusText: doc.getElementById('focus-mode-text')!,
    progress: doc.getElementById('focus-mode-progress')!,
    offButton: doc.getElementById('focus-mode-off')!,
  };
}

/** When Focus Mode is on, everything else melts away in favor of today's
 *  focus (large, centered) plus a task-progress indicator (§9). Returns
 *  whether the overlay was shown (true) so main() can skip the rest of the
 *  page's init when it was. `onTurnOff` lets callers control what happens
 *  after Focus Mode is switched off (main.ts reloads the page). */
export async function initFocusModeOverlay(
  doc: Document,
  storage: LocalStorage,
  taskRepo: TaskRepo,
  onTurnOff: () => void,
): Promise<boolean> {
  const elements = getFocusModeOverlayElements(doc);

  const [state, focusText, tasks] = await Promise.all([
    getFocusModeState(storage),
    getFocus(storage, new Date()),
    taskRepo.all(),
  ]);

  if (!state.active) return false;

  elements.page.hidden = true;
  elements.overlay.hidden = false;
  elements.focusText.textContent = focusText || 'No focus set for today.';

  const { done, total } = todaysTaskProgress(tasks);
  elements.progress.textContent = total > 0 ? `${done} of ${total} tasks done today` : '';

  elements.offButton.addEventListener('click', async () => {
    await setFocusModeActive(storage, false);
    onTurnOff();
  });

  return true;
}
