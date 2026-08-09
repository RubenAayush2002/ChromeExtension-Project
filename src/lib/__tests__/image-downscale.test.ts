import { describe, it, expect } from 'vitest';
import { fitWithin, needsDownscale, downscaleImage, MAX_DIMENSION } from '../image-downscale';

describe('fitWithin', () => {
  it('leaves an image already within the limit unchanged', () => {
    expect(fitWithin({ width: 1920, height: 1080 })).toEqual({ width: 1920, height: 1080 });
  });

  it('scales a landscape image by its width', () => {
    expect(fitWithin({ width: 5120, height: 2880 })).toEqual({ width: 2560, height: 1440 });
  });

  it('scales a portrait image by its height', () => {
    expect(fitWithin({ width: 2880, height: 5120 })).toEqual({ width: 1440, height: 2560 });
  });

  it('preserves aspect ratio for awkward dimensions', () => {
    const result = fitWithin({ width: 4000, height: 3000 });

    expect(Math.max(result.width, result.height)).toBe(MAX_DIMENSION);
    expect(result.width / result.height).toBeCloseTo(4000 / 3000, 2);
  });

  it('never collapses a very thin edge to zero', () => {
    const result = fitWithin({ width: 10000, height: 3 });

    expect(result.width).toBe(MAX_DIMENSION);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it('leaves an image exactly at the limit unchanged', () => {
    expect(fitWithin({ width: MAX_DIMENSION, height: 1000 })).toEqual({
      width: MAX_DIMENSION,
      height: 1000,
    });
  });

  it('honours a custom maximum', () => {
    expect(fitWithin({ width: 1000, height: 500 }, 500)).toEqual({ width: 500, height: 250 });
  });
});

describe('needsDownscale', () => {
  it('is false at or below the limit', () => {
    expect(needsDownscale({ width: MAX_DIMENSION, height: 100 })).toBe(false);
    expect(needsDownscale({ width: 800, height: 600 })).toBe(false);
  });

  it('is true above the limit on either axis', () => {
    expect(needsDownscale({ width: MAX_DIMENSION + 1, height: 100 })).toBe(true);
    expect(needsDownscale({ width: 100, height: MAX_DIMENSION + 1 })).toBe(true);
  });
});

describe('downscaleImage', () => {
  it('returns the original blob when the image cannot be decoded', async () => {
    // jsdom has no createImageBitmap/OffscreenCanvas, so this exercises the
    // catch path — which is the behaviour that matters: a failed resize must
    // never lose the user's upload.
    const original = new Blob(['not really an image'], { type: 'image/png' });

    const result = await downscaleImage(original);

    expect(result).toBe(original);
  });
});
