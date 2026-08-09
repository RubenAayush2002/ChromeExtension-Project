import type { WordLookupCache, WordLookupEntry } from '@/lib/ai-only-features';
import { STORES, getAll, put } from '@/db/database';

export function createIndexedDbWordLookupCache(): WordLookupCache {
  return {
    async get(word) {
      // The store is keyed by word; getAll keeps this consistent with the
      // other repos rather than introducing a second access pattern.
      const all = await getAll<WordLookupEntry>(STORES.wordLookupCache);
      return all.find((entry) => entry.word === word) ?? null;
    },
    put: (entry) => put(STORES.wordLookupCache, entry),
  };
}
