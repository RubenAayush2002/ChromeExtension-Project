/** The subset of chrome.storage.LocalStorageArea this project's lib/ modules
 *  actually depend on. Narrower than the full chrome.storage.local type so
 *  the in-memory test fake can satisfy it without stubbing quota/onChanged. */
export interface LocalStorage {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}
