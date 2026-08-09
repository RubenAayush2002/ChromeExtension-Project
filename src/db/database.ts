const DB_NAME = 'personal-home-base';
const DB_VERSION = 4;

export const STORES = {
  tasks: 'tasks',
  tabSets: 'savedTabSets',
  bookmarkMeta: 'bookmarkMeta',
  readLater: 'readLater',
  wordLookupCache: 'wordLookupCache',
  backgrounds: 'backgrounds',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

/** Single shared IndexedDB connection for all of this project's object
 *  stores. Bump DB_VERSION and add a store here whenever a new one is needed
 *  — onupgradeneeded only fires on a version bump, and re-running it is safe
 *  since each store creation is guarded by an existence check. */
export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const keyPath =
            storeName === STORES.bookmarkMeta
              ? 'bookmarkId'
              : storeName === STORES.wordLookupCache
                ? 'word'
                : 'id';
          db.createObjectStore(storeName, { keyPath });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/** Reads a single record by primary key.
 *
 *  Prefer this over getAll() + find whenever records are large: getAll
 *  deserializes every value in the store, which for image blobs means loading
 *  tens of megabytes to retrieve one. */
export async function getByKey<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function put(storeName: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteByKey(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
