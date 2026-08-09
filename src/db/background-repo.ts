import { STORES, getAll, getByKey, put, deleteByKey } from '@/db/database';

export interface BackgroundPhoto {
  id: string;
  blob: Blob;
  name: string;
  addedAt: number;
}

export interface BackgroundPhotoRepo {
  all(): Promise<BackgroundPhoto[]>;
  get(id: string): Promise<BackgroundPhoto | null>;
  put(photo: BackgroundPhoto): Promise<void>;
  delete(id: string): Promise<void>;
}

export function createIndexedDbBackgroundRepo(): BackgroundPhotoRepo {
  return {
    all: () => getAll<BackgroundPhoto>(STORES.backgrounds),
    // Keyed lookup, not getAll + find: the new tab page calls this on every
    // open, and scanning would deserialize every stored image to return one.
    get: (id) => getByKey<BackgroundPhoto>(STORES.backgrounds, id),
    put: (photo) => put(STORES.backgrounds, photo),
    delete: (id) => deleteByKey(STORES.backgrounds, id),
  };
}
