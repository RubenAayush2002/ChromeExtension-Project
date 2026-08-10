import type { PageExtractResult } from '@/content/page-extract';

/** Injects the compiled content/page-extract.js into the given tab, then
 *  reads the stashed result back off `window`. Two-step because a bundled
 *  content script's own completion value can't be relied on as the
 *  executeScript return; see page-extract.ts for why. */
export async function extractFromTab(tabId: number): Promise<PageExtractResult | null> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/page-extract.js'],
  });

  const [{ result } = { result: undefined }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (window as unknown as Record<string, unknown>).__zeroDriftExtractResult,
  });

  return (result as PageExtractResult | undefined) ?? null;
}
