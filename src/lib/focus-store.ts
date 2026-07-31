import type { LocalStorage } from './storage-types';

export interface FocusState {
  focus_today: string;
  focus_today_date: string; // YYYY-MM-DD, local
}

const STORAGE_KEY = 'focus';
export const FOCUS_MIDNIGHT_ALARM = 'focus-midnight-reset';

export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getFocus(storage: LocalStorage, now: Date): Promise<string> {
  const { [STORAGE_KEY]: state } = await storage.get(STORAGE_KEY);
  const focus = state as FocusState | undefined;
  if (!focus || focus.focus_today_date !== localDateString(now)) {
    return '';
  }
  return focus.focus_today;
}

export async function setFocus(storage: LocalStorage, text: string, now: Date): Promise<void> {
  const state: FocusState = { focus_today: text, focus_today_date: localDateString(now) };
  await storage.set({ [STORAGE_KEY]: state });
}

/** Called when the midnight alarm fires: clears focus for the new day. */
export async function resetFocusForNewDay(storage: LocalStorage, now: Date): Promise<void> {
  const state: FocusState = { focus_today: '', focus_today_date: localDateString(now) };
  await storage.set({ [STORAGE_KEY]: state });
}
