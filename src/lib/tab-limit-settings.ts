import type { LocalStorage } from './storage-types';
import type { NudgeState } from './tab-limit-nudge';

const THRESHOLD_KEY = 'tabLimit';
const NUDGE_STATE_KEY = 'tabLimitNudgeState';

const DEFAULT_THRESHOLD = 20;

export async function getTabLimitThreshold(storage: LocalStorage): Promise<number> {
  const { [THRESHOLD_KEY]: threshold } = await storage.get(THRESHOLD_KEY);
  return typeof threshold === 'number' ? threshold : DEFAULT_THRESHOLD;
}

export async function setTabLimitThreshold(storage: LocalStorage, threshold: number): Promise<void> {
  await storage.set({ [THRESHOLD_KEY]: threshold });
}

export async function getNudgeState(storage: LocalStorage): Promise<NudgeState> {
  const { [NUDGE_STATE_KEY]: state } = await storage.get(NUDGE_STATE_KEY);
  return (state as NudgeState | undefined) ?? { lastNotifiedAtCount: null };
}

export async function setNudgeState(storage: LocalStorage, state: NudgeState): Promise<void> {
  await storage.set({ [NUDGE_STATE_KEY]: state });
}
