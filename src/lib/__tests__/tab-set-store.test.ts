import { describe, it, expect } from 'vitest';
import { saveTabSet, renameTabSet, deleteTabSet, type SavedTabSet, type TabSetRepo } from '../tab-set-store';

function createInMemoryTabSetRepo(): TabSetRepo {
  const sets = new Map<string, SavedTabSet>();
  return {
    all: async () => [...sets.values()],
    put: async (set) => {
      sets.set(set.id, set);
    },
    delete: async (id) => {
      sets.delete(id);
    },
  };
}

describe('tab-set-store', () => {
  it('saves a named set of urls', async () => {
    const repo = createInMemoryTabSetRepo();
    const set = await saveTabSet(repo, 'Trip planning', ['https://a.com', 'https://b.com'], Date.now());
    expect(set.name).toBe('Trip planning');
    expect(set.urls).toEqual(['https://a.com', 'https://b.com']);
    expect(await repo.all()).toHaveLength(1);
  });

  it('renames an existing set', async () => {
    const repo = createInMemoryTabSetRepo();
    const set = await saveTabSet(repo, 'Old name', ['https://a.com'], Date.now());
    await renameTabSet(repo, set.id, 'New name');
    const [updated] = await repo.all();
    expect(updated!.name).toBe('New name');
  });

  it('does nothing when renaming a non-existent set', async () => {
    const repo = createInMemoryTabSetRepo();
    await renameTabSet(repo, 'missing-id', 'New name');
    expect(await repo.all()).toEqual([]);
  });

  it('deletes a set', async () => {
    const repo = createInMemoryTabSetRepo();
    const set = await saveTabSet(repo, 'To delete', ['https://a.com'], Date.now());
    await deleteTabSet(repo, set.id);
    expect(await repo.all()).toEqual([]);
  });
});
