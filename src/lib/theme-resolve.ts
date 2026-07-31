export interface ThemeSettings {
  mode: 'light' | 'dark' | 'auto';
  autoBasis: 'system' | 'time';
  timeRange?: { start: number; end: number }; // hours 0-23, e.g. dark 20:00-06:00
}

/** Resolves the effective light/dark mode. `prefersDarkSystem` is injected so
 *  this stays testable without a real `window.matchMedia`. */
export function resolveEffectiveMode(
  theme: ThemeSettings,
  hour: number,
  prefersDarkSystem: boolean,
): 'light' | 'dark' {
  if (theme.mode !== 'auto') return theme.mode;

  if (theme.autoBasis === 'time' && theme.timeRange) {
    const { start, end } = theme.timeRange;
    const inRange = start < end ? hour >= start && hour < end : hour >= start || hour < end;
    return inRange ? 'dark' : 'light';
  }

  return prefersDarkSystem ? 'dark' : 'light';
}
