import type { AiProvider } from './ai-provider';
import { withSmartFallback, type SmartResult } from './smart-call';
import type { LocalStorage } from './storage-types';

const SYSTEM_PROMPT = [
  'You write a one-or-two sentence summary of a web page, for a read-later list.',
  'Rules:',
  '- Plain language. No preamble like "This article discusses".',
  '- Say what the page is actually about and why someone saved it.',
  '- Maximum 200 characters. Output the summary only, nothing else.',
].join('\n');

const MAX_PREVIEW_LENGTH = 200;
/** Cap on page text sent to the model — keeps requests small and fast. */
const MAX_INPUT_CHARS = 4000;

export function parseSmartPreview(response: string): string {
  const preview = response.trim().replace(/\s+/g, ' ');
  if (!preview) throw new Error('Empty smart preview.');

  return preview.length > MAX_PREVIEW_LENGTH
    ? `${preview.slice(0, MAX_PREVIEW_LENGTH).trimEnd()}…`
    : preview;
}

/** §10.2 read-later preview. Smart mode writes a real summary; simple mode
 *  uses the page's opening lines. Same "Save for later" button.
 *
 *  `openingLines` is the already-extracted simple preview — passed in rather
 *  than re-derived so this stays free of DOM access. */
export async function buildPreviewSmart(
  storage: LocalStorage,
  provider: AiProvider,
  pageText: string,
  openingLines: string,
): Promise<SmartResult<string>> {
  return withSmartFallback(
    storage,
    provider,
    {
      system: SYSTEM_PROMPT,
      user: pageText.slice(0, MAX_INPUT_CHARS),
      maxTokens: 128,
    },
    parseSmartPreview,
    () => openingLines,
  );
}
