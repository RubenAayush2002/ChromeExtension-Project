import type { BookmarkMeta, BookmarkMetaRepo } from '@/lib/bookmark-order';
import { STORES, getAll, put, deleteByKey } from '@/db/database';

export function createIndexedDbBookmarkMetaRepo(): BookmarkMetaRepo {
  return {
    all: () => getAll<BookmarkMeta>(STORES.bookmarkMeta),
    put: (meta) => put(STORES.bookmarkMeta, meta),
    delete: (bookmarkId) => deleteByKey(STORES.bookmarkMeta, bookmarkId),
  };
}
