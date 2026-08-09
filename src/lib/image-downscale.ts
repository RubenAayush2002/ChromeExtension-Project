/** Longest-edge ceiling for stored background photos. Comfortably covers a
 *  5K display once the image is stretched to cover, while cutting a typical
 *  12MP phone photo to a fraction of its original bytes. */
export const MAX_DIMENSION = 2560;

/** WebP quality for re-encoded uploads. 0.85 is visually indistinguishable at
 *  wallpaper scale and roughly a tenth the size of source JPEG/PNG. */
export const WEBP_QUALITY = 0.85;

export interface Dimensions {
  width: number;
  height: number;
}

/** Scales dimensions so the longest edge is at most MAX_DIMENSION, preserving
 *  aspect ratio. Images already within the limit are returned unchanged —
 *  re-encoding a small image would only lose quality for no benefit. */
export function fitWithin(source: Dimensions, maxDimension: number = MAX_DIMENSION): Dimensions {
  const longest = Math.max(source.width, source.height);
  if (longest <= maxDimension) return { width: source.width, height: source.height };

  const scale = maxDimension / longest;
  return {
    // Round rather than floor so a 1-pixel edge never collapses to 0.
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

/** Whether an image at these dimensions needs re-encoding at all. */
export function needsDownscale(source: Dimensions, maxDimension: number = MAX_DIMENSION): boolean {
  return Math.max(source.width, source.height) > maxDimension;
}

/** Downscales an image blob to fit MAX_DIMENSION, re-encoding as WebP.
 *
 *  Returns the original blob untouched when the image is already small enough,
 *  or if anything in the decode/encode path fails — a background that stores
 *  at full size is far better than an upload that errors out. */
export async function downscaleImage(blob: Blob, maxDimension: number = MAX_DIMENSION): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const source = { width: bitmap.width, height: bitmap.height };

    if (!needsDownscale(source, maxDimension)) {
      bitmap.close();
      return blob;
    }

    const target = fitWithin(source, maxDimension);
    const canvas = new OffscreenCanvas(target.width, target.height);
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return blob;
    }

    context.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close();

    const resized = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
    // Guard against the pathological case where re-encoding grew the file.
    return resized.size < blob.size ? resized : blob;
  } catch {
    return blob;
  }
}
