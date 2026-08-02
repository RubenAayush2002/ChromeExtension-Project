import { describe, it, expect } from 'vitest';
import { planTabGroupsByHostname } from '../tab-tidy';

describe('planTabGroupsByHostname', () => {
  it('groups tabs that share a hostname', () => {
    const plans = planTabGroupsByHostname([
      { id: 1, url: 'https://github.com/a' },
      { id: 2, url: 'https://github.com/b' },
      { id: 3, url: 'https://example.com' },
    ]);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ hostname: 'github.com', tabIds: [1, 2] });
  });

  it('skips hostnames that only appear once (no single-tab groups)', () => {
    const plans = planTabGroupsByHostname([
      { id: 1, url: 'https://github.com/a' },
      { id: 2, url: 'https://example.com' },
    ]);
    expect(plans).toEqual([]);
  });

  it('skips tabs with unparseable urls (e.g. chrome:// pages)', () => {
    const plans = planTabGroupsByHostname([
      { id: 1, url: 'chrome://extensions' },
      { id: 2, url: 'chrome://settings' },
    ]);
    expect(plans).toEqual([]);
  });

  it('assigns the same deterministic color as colorForHostname for a given host', () => {
    const plans = planTabGroupsByHostname([
      { id: 1, url: 'https://github.com/a' },
      { id: 2, url: 'https://github.com/b' },
    ]);
    expect(plans[0]!.color).toBeDefined();
  });

  it('handles multiple distinct multi-tab groups', () => {
    const plans = planTabGroupsByHostname([
      { id: 1, url: 'https://github.com/a' },
      { id: 2, url: 'https://github.com/b' },
      { id: 3, url: 'https://news.example.com/x' },
      { id: 4, url: 'https://news.example.com/y' },
    ]);
    expect(plans).toHaveLength(2);
    const hostnames = plans.map((p) => p.hostname).sort();
    expect(hostnames).toEqual(['github.com', 'news.example.com']);
  });
});
