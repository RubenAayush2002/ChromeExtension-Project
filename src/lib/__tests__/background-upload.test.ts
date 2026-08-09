import { describe, it, expect } from 'vitest';
import { addPhoto, deletePhoto, validatePhotoFile, MAX_PHOTO_BYTES } from '../background-upload';
import type { BackgroundPhoto, BackgroundPhotoRepo } from '@/db/background-repo';

function createInMemoryRepo(initial: BackgroundPhoto[] = []): BackgroundPhotoRepo {
  const photos = new Map(initial.map((p) => [p.id, p]));
  return {
    all: async () => [...photos.values()],
    get: async (id) => photos.get(id) ?? null,
    put: async (photo) => {
      photos.set(photo.id, photo);
    },
    delete: async (id) => {
      photos.delete(id);
    },
  };
}

function makeFile(type: string, size: number, name = 'photo.png'): File {
  // jsdom's File doesn't let `size` be set from content cheaply, so it's
  // stubbed directly — validation only reads type/size/name.
  return { type, size, name } as File;
}

function makePhoto(overrides: Partial<BackgroundPhoto> = {}): BackgroundPhoto {
  return { id: '1', blob: new Blob(['x']), name: 'a.png', addedAt: 1000, ...overrides };
}

describe('validatePhotoFile', () => {
  it('accepts common image types', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']) {
      expect(validatePhotoFile({ type, size: 1000 }).ok).toBe(true);
    }
  });

  it('rejects video, per the photo-only rule in the spec', () => {
    const result = validatePhotoFile({ type: 'video/mp4', size: 1000 });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('not supported');
  });

  it('rejects a file over the size ceiling', () => {
    const result = validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('too large');
  });

  it('accepts a file exactly at the ceiling', () => {
    expect(validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES }).ok).toBe(true);
  });

  it('rejects an empty file', () => {
    expect(validatePhotoFile({ type: 'image/png', size: 0 }).ok).toBe(false);
  });
});

describe('addPhoto', () => {
  it('stores a valid photo and returns it', async () => {
    const repo = createInMemoryRepo();

    const result = await addPhoto(repo, makeFile('image/png', 5000, 'wallpaper.png'), 4242);

    expect(result.ok).toBe(true);
    const stored = await repo.all();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.name).toBe('wallpaper.png');
    expect(stored[0]!.addedAt).toBe(4242);
  });

  it('does not store an invalid file', async () => {
    const repo = createInMemoryRepo();

    const result = await addPhoto(repo, makeFile('video/mp4', 5000));

    expect(result.ok).toBe(false);
    expect(await repo.all()).toEqual([]);
  });

  it('falls back to a placeholder name when the file has none', async () => {
    const repo = createInMemoryRepo();

    await addPhoto(repo, makeFile('image/png', 100, ''));

    expect((await repo.all())[0]!.name).toBe('Untitled image');
  });
});

describe('deletePhoto', () => {
  it('removes the photo from the repo', async () => {
    const repo = createInMemoryRepo([makePhoto({ id: 'a' })]);

    await deletePhoto(repo, 'a', null);

    expect(await repo.all()).toEqual([]);
  });

  it('keeps the current selection when a different photo is deleted', async () => {
    const repo = createInMemoryRepo([makePhoto({ id: 'a' }), makePhoto({ id: 'b' })]);

    const result = await deletePhoto(repo, 'a', 'b');

    expect(result).toEqual({ nextSelectedId: 'b', wasSelected: false });
  });

  it('falls back to the newest remaining photo when the selected one is deleted', async () => {
    const repo = createInMemoryRepo([
      makePhoto({ id: 'a', addedAt: 1000 }),
      makePhoto({ id: 'b', addedAt: 3000 }),
      makePhoto({ id: 'c', addedAt: 2000 }),
    ]);

    const result = await deletePhoto(repo, 'a', 'a');

    expect(result).toEqual({ nextSelectedId: 'b', wasSelected: true });
  });

  it('reports no replacement when the gallery is now empty', async () => {
    const repo = createInMemoryRepo([makePhoto({ id: 'a' })]);

    // The caller uses a null nextSelectedId to fall back to gradient mode,
    // so the page never renders an empty background layer.
    const result = await deletePhoto(repo, 'a', 'a');

    expect(result).toEqual({ nextSelectedId: null, wasSelected: true });
  });
});
