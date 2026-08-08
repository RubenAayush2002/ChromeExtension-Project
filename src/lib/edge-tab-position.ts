import type { LocalStorage } from './storage-types';

export type EdgeTabSide = 'left' | 'right';

export interface EdgeTabPosition {
  side: EdgeTabSide;
  offset: number; // vertical offset from top, in pixels
}

const STORAGE_KEY = 'edgeTabPosition';
const DEFAULT_POSITION: EdgeTabPosition = { side: 'right', offset: 120 };

/** Decides which edge the tab snaps to after a drag, based on which half of
 *  the viewport it was dropped in. Position is per-user (persisted once,
 *  applied on every page), not per-page. */
export function snapSide(dropX: number, viewportWidth: number): EdgeTabSide {
  return dropX < viewportWidth / 2 ? 'left' : 'right';
}

export function clampOffset(offset: number, viewportHeight: number, tabHeight: number): number {
  return Math.max(0, Math.min(offset, viewportHeight - tabHeight));
}

export async function getEdgeTabPosition(storage: LocalStorage): Promise<EdgeTabPosition> {
  const { [STORAGE_KEY]: position } = await storage.get(STORAGE_KEY);
  return (position as EdgeTabPosition | undefined) ?? DEFAULT_POSITION;
}

export async function setEdgeTabPosition(storage: LocalStorage, position: EdgeTabPosition): Promise<void> {
  await storage.set({ [STORAGE_KEY]: position });
}
