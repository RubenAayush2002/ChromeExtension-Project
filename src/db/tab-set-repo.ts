import type { SavedTabSet, TabSetRepo } from '@/lib/tab-set-store';
import { STORES, getAll, put, deleteByKey } from '@/db/database';

export function createIndexedDbTabSetRepo(): TabSetRepo {
  return {
    all: () => getAll<SavedTabSet>(STORES.tabSets),
    put: (set) => put(STORES.tabSets, set),
    delete: (id) => deleteByKey(STORES.tabSets, id),
  };
}
