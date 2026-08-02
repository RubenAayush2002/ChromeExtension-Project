export interface NudgeState {
  lastNotifiedAtCount: number | null; // tab count at which we last fired a notification
}

/**
 * Decides whether crossing the threshold should fire a new notification.
 * Fires once per crossing: re-fires only after the count has dropped back
 * below the threshold and crosses it again (no spam on every new tab past the limit).
 */
export function shouldNotify(currentCount: number, threshold: number, state: NudgeState): boolean {
  if (currentCount < threshold) return false;
  if (state.lastNotifiedAtCount !== null && state.lastNotifiedAtCount >= threshold) return false;
  return true;
}

export function recordNotified(currentCount: number): NudgeState {
  return { lastNotifiedAtCount: currentCount };
}

export function recordBelowThreshold(): NudgeState {
  return { lastNotifiedAtCount: null };
}
