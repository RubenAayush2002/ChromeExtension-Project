import type { BackgroundPhoto, BackgroundPhotoRepo } from '@/db/background-repo';
import { downscaleImage } from './image-downscale';

/** Photo-only per §6.3.2 (v3 dropped video uploads entirely). */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/** 12MB. Large enough for a high-resolution wallpaper, small enough that
 *  IndexedDB stays responsive and first paint isn't blocked (§12). */
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export type UploadResult =
  | { ok: true; photo: BackgroundPhoto }
  | { ok: false; message: string };

export function validatePhotoFile(file: { type: string; size: number }): { ok: boolean; message: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, message: 'That file type is not supported. Use a JPEG, PNG, WebP, GIF or AVIF image.' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    const limitMb = Math.round(MAX_PHOTO_BYTES / (1024 * 1024));
    return { ok: false, message: `That image is too large. Keep it under ${limitMb}MB.` };
  }
  if (file.size === 0) {
    return { ok: false, message: 'That file appears to be empty.' };
  }
  return { ok: true, message: '' };
}

/** Validates and stores an uploaded photo. Returns a plain message on refusal
 *  rather than throwing — the picker surfaces it inline (§12). */
export async function addPhoto(
  repo: BackgroundPhotoRepo,
  file: File,
  now: number = Date.now(),
): Promise<UploadResult> {
  const validation = validatePhotoFile(file);
  if (!validation.ok) return { ok: false, message: validation.message };

  // Stored at display scale rather than source scale: a 12MP phone photo is
  // ~10MB on disk and has to be deserialized on every new tab open, but is
  // indistinguishable from a 2560px version once painted as a background.
  const blob = await downscaleImage(file);

  const photo: BackgroundPhoto = {
    id: crypto.randomUUID(),
    blob,
    name: file.name || 'Untitled image',
    addedAt: now,
  };

  await repo.put(photo);
  return { ok: true, photo };
}

/** Deletes a photo. Returns the id to select instead when the deleted one was
 *  active — the most recent remaining photo, or null to fall back to gradient
 *  mode when the gallery is now empty. */
export async function deletePhoto(
  repo: BackgroundPhotoRepo,
  id: string,
  currentlySelectedId: string | null,
): Promise<{ nextSelectedId: string | null; wasSelected: boolean }> {
  await repo.delete(id);

  if (currentlySelectedId !== id) {
    return { nextSelectedId: currentlySelectedId, wasSelected: false };
  }

  const remaining = await repo.all();
  const newest = [...remaining].sort((a, b) => b.addedAt - a.addedAt)[0];
  return { nextSelectedId: newest?.id ?? null, wasSelected: true };
}
