export interface SavedTabSet {
  id: string;
  name: string;
  urls: string[];
  createdAt: number;
}

export interface TabSetRepo {
  all(): Promise<SavedTabSet[]>;
  put(set: SavedTabSet): Promise<void>;
  delete(id: string): Promise<void>;
}

export async function saveTabSet(repo: TabSetRepo, name: string, urls: string[], now: number): Promise<SavedTabSet> {
  const set: SavedTabSet = { id: crypto.randomUUID(), name, urls, createdAt: now };
  await repo.put(set);
  return set;
}

export async function renameTabSet(repo: TabSetRepo, id: string, newName: string): Promise<void> {
  const sets = await repo.all();
  const set = sets.find((s) => s.id === id);
  if (!set) return;
  set.name = newName;
  await repo.put(set);
}

export async function deleteTabSet(repo: TabSetRepo, id: string): Promise<void> {
  await repo.delete(id);
}
