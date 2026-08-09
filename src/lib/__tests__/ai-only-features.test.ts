import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import { setApiKey, setSmartLayerEnabled } from '../smart-layer-store';
import { AiError, type AiProvider } from '../ai-provider';
import { SMART_LAYER_DISABLED_MESSAGE } from '../smart-call';
import {
  explainText,
  explainTextSimpler,
  lookupWord,
  askAcrossTabs,
  parseCitedTabs,
  normalizeWord,
  type WordLookupCache,
  type WordLookupEntry,
  type TabContent,
} from '../ai-only-features';

function providerReturning(response: string): AiProvider {
  return { name: 'fake', complete: async () => response };
}

function providerFailing(): AiProvider {
  return {
    name: 'fake',
    complete: async () => {
      throw new AiError('network', 'down');
    },
  };
}

function createCache(initial: WordLookupEntry[] = []): WordLookupCache & { entries: WordLookupEntry[] } {
  const entries = [...initial];
  return {
    entries,
    get: async (word) => entries.find((e) => e.word === word) ?? null,
    put: async (entry) => {
      entries.push(entry);
    },
  };
}

let chromeFake: ChromeFake;
beforeEach(() => {
  chromeFake = createChromeFake();
});

async function enable(fake: ChromeFake) {
  await setApiKey(fake.storage.local, 'gsk_key');
  await setSmartLayerEnabled(fake.storage.local, true);
}

const TABS: TabContent[] = [
  { title: 'Lisbon guide', url: 'https://a.com', text: 'Lisbon is warm in June.' },
  { title: 'Flights', url: 'https://b.com', text: 'Flights cost 200 euro.' },
];

describe('explain highlighted text', () => {
  it('gates with the settings message when the layer is off', async () => {
    const result = await explainText(chromeFake.storage.local, providerReturning('x'), 'some jargon');

    expect(result).toEqual({ ok: false, reason: 'disabled', message: SMART_LAYER_DISABLED_MESSAGE });
  });

  it('returns the explanation when the layer is on', async () => {
    await enable(chromeFake);

    const result = await explainText(chromeFake.storage.local, providerReturning('It means X.'), 'jargon');

    expect(result).toEqual({ ok: true, value: 'It means X.' });
  });

  it('reports a failed call distinctly from the disabled case', async () => {
    await enable(chromeFake);

    const result = await explainText(chromeFake.storage.local, providerFailing(), 'jargon');

    expect(result).toMatchObject({ ok: false, reason: 'failed' });
    expect((result as { message: string }).message).not.toBe(SMART_LAYER_DISABLED_MESSAGE);
  });

  it('passes the previous explanation into the simpler follow-up', async () => {
    await enable(chromeFake);
    let captured = '';
    const provider: AiProvider = {
      name: 'fake',
      complete: async (req) => {
        captured = req.user;
        return 'Simpler.';
      },
    };

    await explainTextSimpler(chromeFake.storage.local, provider, 'original text', 'too complex');

    expect(captured).toContain('original text');
    expect(captured).toContain('too complex');
  });
});

describe('normalizeWord', () => {
  it('lowercases and strips surrounding punctuation', () => {
    expect(normalizeWord('  "The,"  ')).toBe('the');
  });

  it('keeps internal hyphens', () => {
    expect(normalizeWord('well-known.')).toBe('well-known');
  });

  it('returns empty for punctuation-only input', () => {
    expect(normalizeWord('!!!')).toBe('');
  });
});

describe('hold-key word lookup', () => {
  it('gates when the layer is off and the word is not cached', async () => {
    const result = await lookupWord(
      chromeFake.storage.local,
      providerReturning('x'),
      createCache(),
      'ontology',
      '',
    );

    expect(result).toMatchObject({ ok: false, reason: 'disabled' });
  });

  it('serves a cached word without calling the provider, even when the layer is off', async () => {
    let called = false;
    const provider: AiProvider = {
      name: 'fake',
      complete: async () => {
        called = true;
        return 'fresh';
      },
    };
    const cache = createCache([{ word: 'ontology', meaning: 'a cached meaning', cachedAt: 1 }]);

    const result = await lookupWord(chromeFake.storage.local, provider, cache, 'Ontology,', '');

    expect(result).toEqual({ ok: true, value: 'a cached meaning' });
    expect(called).toBe(false);
  });

  it('caches a freshly looked-up word under its normalized form', async () => {
    await enable(chromeFake);
    const cache = createCache();

    await lookupWord(chromeFake.storage.local, providerReturning('the meaning'), cache, '"Ontology."', '', 5000);

    expect(cache.entries).toEqual([{ word: 'ontology', meaning: 'the meaning', cachedAt: 5000 }]);
  });

  it('does not cache a failed lookup', async () => {
    await enable(chromeFake);
    const cache = createCache();

    const result = await lookupWord(chromeFake.storage.local, providerFailing(), cache, 'ontology', '');

    expect(result.ok).toBe(false);
    expect(cache.entries).toEqual([]);
  });

  it('rejects a word that normalizes to nothing', async () => {
    await enable(chromeFake);

    const result = await lookupWord(chromeFake.storage.local, providerReturning('x'), createCache(), '!!!', '');

    expect(result).toMatchObject({ ok: false, reason: 'failed' });
  });
});

describe('ask across open tabs', () => {
  it('gates when the layer is off', async () => {
    const result = await askAcrossTabs(chromeFake.storage.local, providerReturning('x'), 'when?', TABS);

    expect(result).toMatchObject({ ok: false, reason: 'disabled' });
  });

  it('returns a synthesized answer when the layer is on', async () => {
    await enable(chromeFake);

    const result = await askAcrossTabs(
      chromeFake.storage.local,
      providerReturning('Lisbon is warm [1] and flights are 200 euro [2].'),
      'trip cost?',
      TABS,
    );

    expect(result).toMatchObject({ ok: true });
  });

  it('includes every tab excerpt in the prompt', async () => {
    await enable(chromeFake);
    let captured = '';
    const provider: AiProvider = {
      name: 'fake',
      complete: async (req) => {
        captured = req.user;
        return 'answer';
      },
    };

    await askAcrossTabs(chromeFake.storage.local, provider, 'q', TABS);

    expect(captured).toContain('Lisbon is warm in June.');
    expect(captured).toContain('Flights cost 200 euro.');
  });

  it('reports plainly when there are no tabs to read', async () => {
    await enable(chromeFake);

    const result = await askAcrossTabs(chromeFake.storage.local, providerReturning('x'), 'q', []);

    expect(result).toMatchObject({ ok: false, reason: 'failed' });
  });
});

describe('parseCitedTabs', () => {
  it('extracts cited tab numbers in order, de-duplicated', () => {
    expect(parseCitedTabs('From [2] and [1], also [2] again.', 3)).toEqual([1, 2]);
  });

  it('ignores citations outside the real tab range', () => {
    expect(parseCitedTabs('See [9] and [1].', 2)).toEqual([1]);
  });

  it('returns nothing when the answer cites no tabs', () => {
    expect(parseCitedTabs('The tabs do not contain the answer.', 2)).toEqual([]);
  });
});
