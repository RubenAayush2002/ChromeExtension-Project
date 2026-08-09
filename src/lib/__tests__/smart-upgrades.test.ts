import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import { setApiKey, setSmartLayerEnabled } from '../smart-layer-store';
import type { AiProvider } from '../ai-provider';
import { AiError } from '../ai-provider';
import { parseSmartTaskList, splitTaskBlobSmart } from '../smart-task-split';
import { parseSmartTabGroups, planTabGroupsSmart, type TitledTab } from '../smart-tab-tidy';
import { parseSmartPreview, buildPreviewSmart } from '../smart-preview';
import {
  parseSmartLabels,
  parseSmartSearchResults,
  labelBookmarksSmart,
  searchBookmarksSmart,
} from '../smart-bookmarks';
import type { SearchableBookmark } from '../bookmark-search';

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

async function enable(chromeFake: ChromeFake) {
  await setApiKey(chromeFake.storage.local, 'gsk_key');
  await setSmartLayerEnabled(chromeFake.storage.local, true);
}

let chromeFake: ChromeFake;
beforeEach(() => {
  chromeFake = createChromeFake();
});

describe('smart task splitting', () => {
  it('parses bare lines into tasks', () => {
    expect(parseSmartTaskList('Buy milk\nCall the dentist')).toEqual(['Buy milk', 'Call the dentist']);
  });

  it('strips bullets the model added despite instructions', () => {
    expect(parseSmartTaskList('- Buy milk\n2. Call the dentist')).toEqual(['Buy milk', 'Call the dentist']);
  });

  it('throws on an empty response so the caller falls back', () => {
    expect(() => parseSmartTaskList('   \n  ')).toThrow();
  });

  it('uses simple splitting when the layer is off', async () => {
    const result = await splitTaskBlobSmart(chromeFake.storage.local, providerReturning('Cleaned up'), '- a\n- b');

    expect(result.value).toEqual(['a', 'b']);
    expect(result.usedSmart).toBe(false);
  });

  it('uses the cleaned-up tasks when the layer is on', async () => {
    await enable(chromeFake);

    const result = await splitTaskBlobSmart(
      chromeFake.storage.local,
      providerReturning('Buy milk\nCall the dentist'),
      'milk\ndentist appt',
    );

    expect(result.value).toEqual(['Buy milk', 'Call the dentist']);
    expect(result.usedSmart).toBe(true);
  });

  it('falls back to line splitting when the call fails', async () => {
    await enable(chromeFake);

    const result = await splitTaskBlobSmart(chromeFake.storage.local, providerFailing(), 'a\nb');

    expect(result.value).toEqual(['a', 'b']);
    expect(result.note).toContain('simple version instead');
  });
});

describe('smart tab grouping', () => {
  const tabs: TitledTab[] = [
    { id: 1, url: 'https://kayak.com/flights', title: 'Flights to Lisbon' },
    { id: 2, url: 'https://booking.com/lisbon', title: 'Lisbon hotels' },
    { id: 3, url: 'https://github.com/x', title: 'A repo' },
  ];

  it('maps topic groups back to real tab ids', () => {
    const plans = parseSmartTabGroups('{"groups":[{"label":"Lisbon trip","tabIds":[1,2]}]}', tabs);

    expect(plans).toHaveLength(1);
    expect(plans[0]!.hostname).toBe('Lisbon trip');
    expect(plans[0]!.tabIds).toEqual([1, 2]);
  });

  it('tolerates the model wrapping JSON in code fences', () => {
    const plans = parseSmartTabGroups('```json\n{"groups":[{"label":"Trip","tabIds":[1,2]}]}\n```', tabs);
    expect(plans[0]!.tabIds).toEqual([1, 2]);
  });

  it('drops hallucinated tab ids that were never open', () => {
    const plans = parseSmartTabGroups('{"groups":[{"label":"Trip","tabIds":[1,2,999]}]}', tabs);
    expect(plans[0]!.tabIds).toEqual([1, 2]);
  });

  it('never assigns the same tab to two groups', () => {
    const plans = parseSmartTabGroups(
      '{"groups":[{"label":"A","tabIds":[1,2]},{"label":"B","tabIds":[2,3]}]}',
      tabs,
    );

    const allIds = plans.flatMap((p) => p.tabIds);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('throws on malformed JSON so the caller falls back', () => {
    expect(() => parseSmartTabGroups('not json at all', tabs)).toThrow();
  });

  it('throws when every group is too small to be useful', () => {
    expect(() => parseSmartTabGroups('{"groups":[{"label":"A","tabIds":[1]}]}', tabs)).toThrow();
  });

  it('falls back to hostname grouping when the call fails', async () => {
    await enable(chromeFake);
    const sameHost: TitledTab[] = [
      { id: 1, url: 'https://github.com/a', title: 'a' },
      { id: 2, url: 'https://github.com/b', title: 'b' },
    ];

    const result = await planTabGroupsSmart(chromeFake.storage.local, providerFailing(), sameHost);

    expect(result.usedSmart).toBe(false);
    expect(result.value[0]!.hostname).toBe('github.com');
  });
});

describe('smart preview', () => {
  it('collapses whitespace and returns the summary', () => {
    expect(parseSmartPreview('  A   short\n summary.  ')).toBe('A short summary.');
  });

  it('truncates an over-long summary', () => {
    const parsed = parseSmartPreview('x'.repeat(300));
    expect(parsed.length).toBeLessThanOrEqual(201);
    expect(parsed.endsWith('…')).toBe(true);
  });

  it('throws on an empty summary', () => {
    expect(() => parseSmartPreview('   ')).toThrow();
  });

  it('falls back to the opening lines when the call fails', async () => {
    await enable(chromeFake);

    const result = await buildPreviewSmart(
      chromeFake.storage.local,
      providerFailing(),
      'full page text',
      'the opening lines',
    );

    expect(result.value).toBe('the opening lines');
    expect(result.usedSmart).toBe(false);
  });
});

describe('smart bookmark labels', () => {
  const bookmarks: SearchableBookmark[] = [
    { id: 'a', title: 'Pasta recipe', url: 'https://food.com/pasta' },
    { id: 'b', title: 'Tax guide', url: 'https://gov.uk/tax' },
  ];

  it('maps topic labels by bookmark id', () => {
    const labels = parseSmartLabels('{"labels":{"a":"Recipes","b":"Tax docs"}}', bookmarks);

    expect(labels.get('a')).toBe('Recipes');
    expect(labels.get('b')).toBe('Tax docs');
  });

  it('falls back to a hostname label for any bookmark the model skipped', () => {
    const labels = parseSmartLabels('{"labels":{"a":"Recipes"}}', bookmarks);

    expect(labels.get('a')).toBe('Recipes');
    expect(labels.get('b')).toBe('Gov'); // hostname-derived
  });

  it('throws when no usable labels came back at all', () => {
    expect(() => parseSmartLabels('{"labels":{}}', bookmarks)).toThrow();
  });

  it('falls back to hostname labels for every bookmark when the call fails', async () => {
    await enable(chromeFake);

    const result = await labelBookmarksSmart(chromeFake.storage.local, providerFailing(), bookmarks);

    expect(result.usedSmart).toBe(false);
    expect(result.value.get('a')).toBe('Food');
  });
});

describe('smart bookmark search', () => {
  const bookmarks: SearchableBookmark[] = [
    { id: 'a', title: 'Pasta recipe', url: 'https://food.com/pasta' },
    { id: 'b', title: 'Tax guide', url: 'https://gov.uk/tax' },
  ];

  it('resolves ids back to bookmarks in the order given', () => {
    const results = parseSmartSearchResults('{"ids":["b","a"]}', bookmarks);
    expect(results.map((b) => b.id)).toEqual(['b', 'a']);
  });

  it('drops ids that do not exist', () => {
    const results = parseSmartSearchResults('{"ids":["a","nope"]}', bookmarks);
    expect(results.map((b) => b.id)).toEqual(['a']);
  });

  it('treats an empty match list as a real answer, not a failure', () => {
    expect(parseSmartSearchResults('{"ids":[]}', bookmarks)).toEqual([]);
  });

  it('falls back to keyword search when the call fails', async () => {
    await enable(chromeFake);

    const result = await searchBookmarksSmart(chromeFake.storage.local, providerFailing(), 'pasta', bookmarks);

    expect(result.usedSmart).toBe(false);
    expect(result.value.map((b) => b.id)).toEqual(['a']);
  });
});
