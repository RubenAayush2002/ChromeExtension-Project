import { describe, it, expect } from 'vitest';
import { colorForHostname } from '../domain-color';

describe('colorForHostname', () => {
  it('is deterministic for the same hostname across calls', () => {
    const first = colorForHostname('github.com');
    const second = colorForHostname('github.com');
    expect(first).toBe(second);
  });

  it('is case-insensitive', () => {
    expect(colorForHostname('GitHub.com')).toBe(colorForHostname('github.com'));
  });

  it('assigns a color from the known tab group palette', () => {
    const validColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
    expect(validColors).toContain(colorForHostname('example.com'));
  });

  it('can distinguish different hostnames (not a constant function)', () => {
    const domains = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com', 'g.com', 'h.com'];
    const colors = new Set(domains.map(colorForHostname));
    expect(colors.size).toBeGreaterThan(1);
  });
});
