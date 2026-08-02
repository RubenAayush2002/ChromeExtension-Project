import { describe, it, expect } from 'vitest';
import { saveForLater, removeReadLaterItem, type ReadLaterItem, type ReadLaterRepo } from '../read-later-store';

function createInMemoryReadLaterRepo(): ReadLaterRepo {
  const items = new Map<string, ReadLaterItem>();
  return {
    all: async () => [...items.values()],
    put: async (item) => {
      items.set(item.id, item);
    },
    delete: async (id) => {
      items.delete(id);
    },
  };
}

describe('read-later-store', () => {
  it('saves an item with a real preview, marked not-fallback by default', async () => {
    const repo = createInMemoryReadLaterRepo();
    const item = await saveForLater(repo, 'https://example.com', 'Example Article', 'A short preview.', Date.now());
    expect(item.previewIsFallback).toBe(false);
    expect(await repo.all()).toHaveLength(1);
  });

  it('marks an item as fallback when the smart summary failed', async () => {
    const repo = createInMemoryReadLaterRepo();
    const item = await saveForLater(
      repo,
      'https://example.com',
      'Example Article',
      'Opening lines preview.',
      Date.now(),
      true,
    );
    expect(item.previewIsFallback).toBe(true);
  });

  it('removes an item', async () => {
    const repo = createInMemoryReadLaterRepo();
    const item = await saveForLater(repo, 'https://example.com', 'Title', 'Preview', Date.now());
    await removeReadLaterItem(repo, item.id);
    expect(await repo.all()).toEqual([]);
  });
});
