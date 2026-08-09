import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import { withSmartFallback, runAiOnly, testApiKey, SMART_LAYER_DISABLED_MESSAGE } from '../smart-call';
import { setApiKey, setSmartLayerEnabled } from '../smart-layer-store';
import { AiError, type AiProvider } from '../ai-provider';

function providerReturning(response: string): AiProvider {
  return { name: 'fake', complete: async () => response };
}

function providerFailing(error: Error): AiProvider {
  return {
    name: 'fake',
    complete: async () => {
      throw error;
    },
  };
}

const REQUEST = { system: 's', user: 'u' };

async function enableSmartLayer(chromeFake: ChromeFake) {
  await setApiKey(chromeFake.storage.local, 'gsk_test_key');
  await setSmartLayerEnabled(chromeFake.storage.local, true);
}

describe('withSmartFallback', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('uses the simple path with no note when the layer is off', async () => {
    const result = await withSmartFallback(
      chromeFake.storage.local,
      providerReturning('smart'),
      REQUEST,
      (r) => r,
      () => 'simple',
    );

    expect(result).toEqual({ value: 'simple', usedSmart: false, note: null });
  });

  it('uses the smart path when the layer is on', async () => {
    await enableSmartLayer(chromeFake);

    const result = await withSmartFallback(
      chromeFake.storage.local,
      providerReturning('smart'),
      REQUEST,
      (r) => r,
      () => 'simple',
    );

    expect(result.value).toBe('smart');
    expect(result.usedSmart).toBe(true);
    expect(result.note).toBeNull();
  });

  it('falls back to simple with an explanatory note when the call fails', async () => {
    await enableSmartLayer(chromeFake);

    const result = await withSmartFallback(
      chromeFake.storage.local,
      providerFailing(new AiError('rate-limit', 'boom')),
      REQUEST,
      (r) => r,
      () => 'simple',
    );

    expect(result.value).toBe('simple');
    expect(result.usedSmart).toBe(false);
    expect(result.note).toContain('rate limited');
    expect(result.note).toContain('simple version instead');
  });

  it('falls back when parsing the smart response throws', async () => {
    await enableSmartLayer(chromeFake);

    const result = await withSmartFallback(
      chromeFake.storage.local,
      providerReturning('unparseable'),
      REQUEST,
      () => {
        throw new Error('bad shape');
      },
      () => 'simple',
    );

    // A malformed-but-successful response must not break the feature either.
    expect(result.value).toBe('simple');
    expect(result.usedSmart).toBe(false);
  });

  it('never throws, whatever the provider does', async () => {
    await enableSmartLayer(chromeFake);

    await expect(
      withSmartFallback(
        chromeFake.storage.local,
        providerFailing(new Error('unexpected non-AiError')),
        REQUEST,
        (r) => r,
        () => 'simple',
      ),
    ).resolves.toMatchObject({ value: 'simple', usedSmart: false });
  });

  it('reports an invalid key distinctly so the user can act on it', async () => {
    await enableSmartLayer(chromeFake);

    const result = await withSmartFallback(
      chromeFake.storage.local,
      providerFailing(new AiError('invalid-key', 'nope')),
      REQUEST,
      (r) => r,
      () => 'simple',
    );

    expect(result.note).toContain('Settings');
  });
});

describe('runAiOnly', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('returns the gating message when the layer is off, never a silent no-op', async () => {
    const result = await runAiOnly(chromeFake.storage.local, providerReturning('x'), REQUEST);

    expect(result).toEqual({ ok: false, reason: 'disabled', message: SMART_LAYER_DISABLED_MESSAGE });
  });

  it('returns the answer when the layer is on', async () => {
    await enableSmartLayer(chromeFake);

    const result = await runAiOnly(chromeFake.storage.local, providerReturning('an answer'), REQUEST);

    expect(result).toEqual({ ok: true, value: 'an answer' });
  });

  it('distinguishes a failed call from the disabled case', async () => {
    await enableSmartLayer(chromeFake);

    const result = await runAiOnly(
      chromeFake.storage.local,
      providerFailing(new AiError('timeout', 'slow')),
      REQUEST,
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: 'failed' });
    // Must not be mistaken for the "turn it on in Settings" message.
    expect((result as { message: string }).message).not.toBe(SMART_LAYER_DISABLED_MESSAGE);
  });
});

describe('testApiKey', () => {
  it('passes for a working key', async () => {
    const result = await testApiKey(providerReturning('ok'), 'gsk_valid');
    expect(result).toEqual({ ok: true, message: 'Key works.' });
  });

  it('fails with an actionable message for a rejected key', async () => {
    const result = await testApiKey(providerFailing(new AiError('invalid-key', 'nope')), 'gsk_bad');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('rejected');
  });

  it('refuses to call out with an empty key', async () => {
    let called = false;
    const provider: AiProvider = {
      name: 'fake',
      complete: async () => {
        called = true;
        return 'ok';
      },
    };

    const result = await testApiKey(provider, '   ');

    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });
});
