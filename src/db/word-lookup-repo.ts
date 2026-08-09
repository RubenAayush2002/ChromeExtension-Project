import type { WordLookupCache, WordLookupEntry } from '@/lib/ai-only-features';
import { STORES, getByKey, put } from '@/db/database';

export function createIndexedDbWordLookupCache(): WordLookupCache {
  return {
    // Keyed lookup: this runs on every Alt-hover, and the cache grows with
    // use, so scanning the whole store would get slower over time.
    get: (word) => getByKey<WordLookupEntry>(STORES.wordLookupCache, word),
    put: (entry) => put(STORES.wordLookupCache, entry),
  };
}
