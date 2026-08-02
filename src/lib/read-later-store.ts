export interface ReadLaterItem {
  id: string;
  url: string;
  title: string;
  preview: string;
  previewIsFallback: boolean; // true if smart-mode summary failed and simple preview was used
  savedAt: number;
}

export interface ReadLaterRepo {
  all(): Promise<ReadLaterItem[]>;
  put(item: ReadLaterItem): Promise<void>;
  delete(id: string): Promise<void>;
}

export async function saveForLater(
  repo: ReadLaterRepo,
  url: string,
  title: string,
  preview: string,
  now: number,
  previewIsFallback = false,
): Promise<ReadLaterItem> {
  const item: ReadLaterItem = {
    id: crypto.randomUUID(),
    url,
    title,
    preview,
    previewIsFallback,
    savedAt: now,
  };
  await repo.put(item);
  return item;
}

export async function removeReadLaterItem(repo: ReadLaterRepo, id: string): Promise<void> {
  await repo.delete(id);
}
