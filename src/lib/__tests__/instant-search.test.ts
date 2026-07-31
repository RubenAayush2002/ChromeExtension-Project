import { describe, it, expect } from 'vitest';
import { buildSuggestions, moveSelection } from '../instant-search';

describe('buildSuggestions', () => {
  const inputs = {
    tabs: [
      { id: 1, title: 'GitHub', url: 'https://github.com/foo' },
      { id: 2, title: 'Weather', url: 'https://weather.com' },
    ],
    history: [
      { title: 'GitHub - foo repo', url: 'https://github.com/foo?utm_source=x' },
      { title: 'Recipes', url: 'https://recipes.example.com' },
    ],
  };

  it('returns empty for an empty query', () => {
    expect(buildSuggestions('', inputs)).toEqual([]);
    expect(buildSuggestions('   ', inputs)).toEqual([]);
  });

  it('matches open tabs by title or url, case-insensitively', () => {
    const results = buildSuggestions('github', inputs);
    expect(results.some((r) => r.kind === 'tab' && r.url === 'https://github.com/foo')).toBe(true);
  });

  it('dedupes history entries against tabs already shown by normalized url', () => {
    const results = buildSuggestions('github', inputs);
    const historyDupe = results.find((r) => r.kind === 'history' && r.url.includes('github.com'));
    expect(historyDupe).toBeUndefined();
  });

  it('includes history matches not already covered by open tabs', () => {
    const results = buildSuggestions('recipes', inputs);
    expect(results).toEqual([{ kind: 'history', title: 'Recipes', url: 'https://recipes.example.com' }]);
  });

  it('lists tab matches before history matches', () => {
    const results = buildSuggestions('e', inputs); // matches multiple across both
    const firstHistoryIndex = results.findIndex((r) => r.kind === 'history');
    const lastTabIndex = results.map((r) => r.kind).lastIndexOf('tab');
    if (firstHistoryIndex !== -1 && lastTabIndex !== -1) {
      expect(lastTabIndex).toBeLessThan(firstHistoryIndex);
    }
  });
});

describe('moveSelection', () => {
  it('returns -1 when there are no items', () => {
    expect(moveSelection(-1, 'down', 0)).toBe(-1);
  });

  it('selects the first item on first "down" press from no selection', () => {
    expect(moveSelection(-1, 'down', 3)).toBe(0);
  });

  it('selects the last item on first "up" press from no selection', () => {
    expect(moveSelection(-1, 'up', 3)).toBe(2);
  });

  it('wraps around at the end going down', () => {
    expect(moveSelection(2, 'down', 3)).toBe(0);
  });

  it('wraps around at the start going up', () => {
    expect(moveSelection(0, 'up', 3)).toBe(2);
  });
});
