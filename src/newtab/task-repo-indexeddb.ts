import type { Task, TaskRepo } from '@/lib/task-store';

const DB_NAME = 'personal-home-base';
const DB_VERSION = 1;
const STORE_NAME = 'tasks';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIndexedDbTaskRepo(): TaskRepo {
  return {
    async all() {
      const db = await openDb();
      return new Promise<Task[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as Task[]);
        request.onerror = () => reject(request.error);
      });
    },
    async put(task) {
      const db = await openDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(task);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async delete(id) {
      const db = await openDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}
