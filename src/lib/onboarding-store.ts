import type { LocalStorage } from './storage-types';

const STORAGE_KEY = 'onboardingComplete';

/** Whether the first-run walkthrough has been dismissed.
 *
 *  Tracked as its own flag rather than inferred from "is the name empty?":
 *  someone who deliberately skips the step, or clears their name later, should
 *  not be prompted again on every new tab. */
export async function isOnboardingComplete(storage: LocalStorage): Promise<boolean> {
  const { [STORAGE_KEY]: complete } = await storage.get(STORAGE_KEY);
  return complete === true;
}

export async function markOnboardingComplete(storage: LocalStorage): Promise<void> {
  await storage.set({ [STORAGE_KEY]: true });
}

/** Trims and length-caps a submitted name. The greeting renders this directly,
 *  so an unbounded value would overflow the header. */
export function normalizeName(raw: string): string {
  return raw.trim().slice(0, 40);
}
