import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from './chrome-fake';
import { snapSide, clampOffset, getEdgeTabPosition, setEdgeTabPosition } from '../edge-tab-position';

describe('snapSide', () => {
  it('snaps left when dropped in the left half of the viewport', () => {
    expect(snapSide(100, 1200)).toBe('left');
  });

  it('snaps right when dropped in the right half of the viewport', () => {
    expect(snapSide(900, 1200)).toBe('right');
  });

  it('snaps right exactly at the midpoint', () => {
    expect(snapSide(600, 1200)).toBe('right');
  });
});

describe('clampOffset', () => {
  it('leaves an in-range offset unchanged', () => {
    expect(clampOffset(300, 900, 60)).toBe(300);
  });

  it('clamps to 0 when negative', () => {
    expect(clampOffset(-50, 900, 60)).toBe(0);
  });

  it('clamps so the tab does not run off the bottom of the viewport', () => {
    expect(clampOffset(880, 900, 60)).toBe(840);
  });
});

describe('edge-tab position storage', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('defaults to right side when unset', async () => {
    const position = await getEdgeTabPosition(chromeFake.storage.local);
    expect(position.side).toBe('right');
  });

  it('persists a chosen position independent of which page set it', async () => {
    await setEdgeTabPosition(chromeFake.storage.local, { side: 'left', offset: 250 });
    const position = await getEdgeTabPosition(chromeFake.storage.local);
    expect(position).toEqual({ side: 'left', offset: 250 });
  });
});
