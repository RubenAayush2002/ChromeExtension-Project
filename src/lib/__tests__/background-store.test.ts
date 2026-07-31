import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import { getBackgroundSettings, setBackgroundSettings, type BackgroundMode } from '../background-store';

describe('background-store', () => {
  let chromeFake: ChromeFake;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    chromeFake = createChromeFake();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('defaults to gradient mode when nothing is set', async () => {
    const settings = await getBackgroundSettings(chromeFake.storage.local);
    expect(settings.mode).toBe('gradient');
  });

  it('persists a mode/selection change and reflects it on read', async () => {
    await setBackgroundSettings(chromeFake.storage.local, { mode: 'photo', selectedId: 'abc123' });
    const settings = await getBackgroundSettings(chromeFake.storage.local);
    expect(settings).toEqual({ mode: 'photo', selectedId: 'abc123' });
  });

  it.each<BackgroundMode>(['gradient', 'photo', 'curatedArt', 'weatherMatched'])(
    'never triggers a network fetch when switching to mode "%s"',
    async (mode) => {
      await setBackgroundSettings(chromeFake.storage.local, { mode, selectedId: null });
      await getBackgroundSettings(chromeFake.storage.local);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );
});
