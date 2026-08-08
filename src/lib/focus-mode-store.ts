import type { LocalStorage } from './storage-types';
import { isHostBlocked } from './focus-mode-blocklist';

export interface FocusModePass {
  host: string;
  expiresAt: number;
}

export interface FocusModeState {
  active: boolean;
  blocklist: string[];
  activePasses: FocusModePass[];
}

const STORAGE_KEY = 'focusMode';
export const FIVE_MINUTE_PASS_MS = 5 * 60 * 1000;

const DEFAULT_STATE: FocusModeState = { active: false, blocklist: [], activePasses: [] };

export async function getFocusModeState(storage: LocalStorage): Promise<FocusModeState> {
  const { [STORAGE_KEY]: state } = await storage.get(STORAGE_KEY);
  return (state as FocusModeState | undefined) ?? DEFAULT_STATE;
}

async function setFocusModeState(storage: LocalStorage, state: FocusModeState): Promise<void> {
  await storage.set({ [STORAGE_KEY]: state });
}

export async function setFocusModeActive(storage: LocalStorage, active: boolean): Promise<void> {
  const state = await getFocusModeState(storage);
  await setFocusModeState(storage, { ...state, active });
}

export async function setBlocklist(storage: LocalStorage, blocklist: string[]): Promise<void> {
  const state = await getFocusModeState(storage);
  await setFocusModeState(storage, { ...state, blocklist });
}

/** Grants a temporary 5-minute pass for a host, replacing any existing pass for it. */
export async function grantPass(storage: LocalStorage, host: string, now: number): Promise<void> {
  const state = await getFocusModeState(storage);
  const activePasses = [...state.activePasses.filter((p) => p.host !== host), { host, expiresAt: now + FIVE_MINUTE_PASS_MS }];
  await setFocusModeState(storage, { ...state, activePasses });
}

/** Drops any passes that have expired as of `now`. Call this on the periodic
 *  re-block alarm so a stale pass doesn't linger in storage forever. */
export async function pruneExpiredPasses(storage: LocalStorage, now: number): Promise<void> {
  const state = await getFocusModeState(storage);
  const activePasses = state.activePasses.filter((p) => p.expiresAt > now);
  if (activePasses.length !== state.activePasses.length) {
    await setFocusModeState(storage, { ...state, activePasses });
  }
}

function hasActivePass(state: FocusModeState, host: string, now: number): boolean {
  return state.activePasses.some((p) => isHostBlocked(host, [p.host]) && p.expiresAt > now);
}

/** Whether navigating to `url` should be redirected to the Blocked page:
 *  Focus Mode is on, the host is blocklisted, and no active pass covers it. */
export function shouldBlockNavigation(state: FocusModeState, hostname: string, now: number): boolean {
  if (!state.active) return false;
  if (!isHostBlocked(hostname, state.blocklist)) return false;
  if (hasActivePass(state, hostname, now)) return false;
  return true;
}
