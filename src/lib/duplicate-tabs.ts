import { normalizeUrl } from './url-normalize';

export interface DuplicateCheckTab {
  id: number;
  url: string;
}

/**
 * Returns the ids of tabs to close: for each group of tabs sharing a
 * normalized URL, keeps the first (lowest tab id / earliest in list) and
 * marks the rest as duplicates.
 */
export function findDuplicateTabIds(tabs: DuplicateCheckTab[]): number[] {
  const seen = new Map<string, number>();
  const duplicates: number[] = [];

  for (const tab of tabs) {
    const key = normalizeUrl(tab.url);
    if (seen.has(key)) {
      duplicates.push(tab.id);
    } else {
      seen.set(key, tab.id);
    }
  }

  return duplicates;
}
