import { describe, it, expect } from 'vitest';
import { curatedArtSlotForHour } from '../curated-art-time';

describe('curatedArtSlotForHour', () => {
  it('is daytime from 6am up to (not including) 6pm', () => {
    expect(curatedArtSlotForHour(6)).toBe('daytime');
    expect(curatedArtSlotForHour(17)).toBe('daytime');
  });

  it('is sunset during the 6-8pm and 5-6am twilight windows', () => {
    expect(curatedArtSlotForHour(18)).toBe('sunset');
    expect(curatedArtSlotForHour(19)).toBe('sunset');
    expect(curatedArtSlotForHour(5)).toBe('sunset');
  });

  it('is nighttime otherwise', () => {
    expect(curatedArtSlotForHour(23)).toBe('nighttime');
    expect(curatedArtSlotForHour(0)).toBe('nighttime');
    expect(curatedArtSlotForHour(3)).toBe('nighttime');
  });
});
