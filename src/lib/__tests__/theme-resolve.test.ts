import { describe, it, expect } from 'vitest';
import { resolveEffectiveMode } from '../theme-resolve';

describe('resolveEffectiveMode', () => {
  it('returns manual light/dark directly, ignoring time/system', () => {
    expect(resolveEffectiveMode({ mode: 'light', autoBasis: 'system' }, 23, true)).toBe('light');
    expect(resolveEffectiveMode({ mode: 'dark', autoBasis: 'system' }, 9, false)).toBe('dark');
  });

  it('follows system preference in auto+system mode', () => {
    expect(resolveEffectiveMode({ mode: 'auto', autoBasis: 'system' }, 12, true)).toBe('dark');
    expect(resolveEffectiveMode({ mode: 'auto', autoBasis: 'system' }, 12, false)).toBe('light');
  });

  it('follows a same-day time range (e.g. 9-17 dark)', () => {
    const theme = { mode: 'auto' as const, autoBasis: 'time' as const, timeRange: { start: 9, end: 17 } };
    expect(resolveEffectiveMode(theme, 10, false)).toBe('dark');
    expect(resolveEffectiveMode(theme, 20, false)).toBe('light');
  });

  it('follows a midnight-wrapping time range (e.g. dark after 8pm until 6am)', () => {
    const theme = { mode: 'auto' as const, autoBasis: 'time' as const, timeRange: { start: 20, end: 6 } };
    expect(resolveEffectiveMode(theme, 22, false)).toBe('dark');
    expect(resolveEffectiveMode(theme, 3, false)).toBe('dark');
    expect(resolveEffectiveMode(theme, 12, false)).toBe('light');
  });

  it('falls back to system preference if time mode is selected but no range is set', () => {
    expect(resolveEffectiveMode({ mode: 'auto', autoBasis: 'time' }, 12, true)).toBe('dark');
  });
});
