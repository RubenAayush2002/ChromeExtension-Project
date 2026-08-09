import type { AiProvider, AiRequest } from './ai-provider';
import { describeAiError } from './ai-provider';
import { getSmartLayerSettings, isSmartModeActive } from './smart-layer-store';
import type { LocalStorage } from './storage-types';

/** Outcome of an upgraded (§10.2) feature call.
 *
 *  `usedSmart` tells the UI whether it's showing the upgraded result, and
 *  `note` carries the short, honest message from §10.4 when it isn't. A null
 *  note with usedSmart false means the layer is simply off — that's the normal
 *  default state and deserves no message at all. */
export interface SmartResult<T> {
  value: T;
  usedSmart: boolean;
  note: string | null;
}

/** Runs `smart` when the smart layer is active, falling back to `simple` on any
 *  failure (§10.4). The simple path is always available, so this never throws
 *  and never leaves a feature broken.
 *
 *  `simple` is a function rather than a value so the fallback work is skipped
 *  entirely when the smart path succeeds. */
export async function withSmartFallback<T>(
  storage: LocalStorage,
  provider: AiProvider,
  request: AiRequest,
  parse: (response: string) => T,
  simple: () => T,
): Promise<SmartResult<T>> {
  const settings = await getSmartLayerSettings(storage);
  if (!isSmartModeActive(settings)) {
    return { value: simple(), usedSmart: false, note: null };
  }

  try {
    const response = await provider.complete(request, settings.apiKey);
    return { value: parse(response), usedSmart: true, note: null };
  } catch (error) {
    return {
      value: simple(),
      usedSmart: false,
      note: `${describeAiError(error)} Showed the simple version instead.`,
    };
  }
}

/** Outcome of an AI-only (§10.3) feature call, which has no simple equivalent.
 *  `reason` distinguishes the two failure cases the spec insists stay
 *  distinct: the layer being off (actionable — point at Settings) versus a
 *  call that failed (not the user's fault). */
export type AiOnlyResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'disabled' | 'failed'; message: string };

export const SMART_LAYER_DISABLED_MESSAGE = 'This needs the smart layer turned on in Settings';

/** Runs an AI-only feature. Never silently no-ops: when the layer is off it
 *  returns the §10.3 gating message, and when a call fails it returns a plain
 *  "couldn't complete this" distinct from the gating case. */
export async function runAiOnly(
  storage: LocalStorage,
  provider: AiProvider,
  request: AiRequest,
): Promise<AiOnlyResult> {
  const settings = await getSmartLayerSettings(storage);
  if (!isSmartModeActive(settings)) {
    return { ok: false, reason: 'disabled', message: SMART_LAYER_DISABLED_MESSAGE };
  }

  try {
    return { ok: true, value: await provider.complete(request, settings.apiKey) };
  } catch (error) {
    return { ok: false, reason: 'failed', message: `${describeAiError(error)} Couldn't complete this right now.` };
  }
}

/** One lightweight call used by the settings Test button (§10.1). Returns a
 *  pass/fail result with a human-readable message rather than throwing. */
export async function testApiKey(
  provider: AiProvider,
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim()) return { ok: false, message: 'Enter an API key first.' };

  try {
    await provider.complete(
      { system: 'You are a connectivity check.', user: 'Reply with the single word: ok', maxTokens: 5 },
      apiKey,
    );
    return { ok: true, message: 'Key works.' };
  } catch (error) {
    return { ok: false, message: describeAiError(error) };
  }
}
