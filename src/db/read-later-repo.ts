import type { ReadLaterItem, ReadLaterRepo } from '@/lib/read-later-store';
import { STORES, getAll, put, deleteByKey } from '@/db/database';

export function createIndexedDbReadLaterRepo(): ReadLaterRepo {
  return {
    all: () => getAll<ReadLaterItem>(STORES.readLater),
    put: (item) => put(STORES.readLater, item),
    delete: (id) => deleteByKey(STORES.readLater, id),
  };
}
