import type { AiProvider } from './ai-provider';
import { withSmartFallback, type SmartResult } from './smart-call';
import { splitTaskBlob } from './task-split';
import type { LocalStorage } from './storage-types';

const SYSTEM_PROMPT = [
  'You turn a pasted blob of text into a clean to-do list.',
  'Rules:',
  '- Output ONE task per line, nothing else. No numbering, no bullets, no commentary.',
  '- Fix wording so each line is a clear, actionable task.',
  '- Merge lines that are obviously fragments of the same task.',
  '- Drop junk: headers, dates alone, page numbers, empty filler.',
  '- Keep the original meaning. Never invent tasks that are not implied by the input.',
  '- If nothing looks like a task, output nothing.',
].join('\n');

const MAX_TASKS = 50;
const MAX_TASK_LENGTH = 200;

/** Parses the model's reply back into task lines.
 *
 *  Deliberately strict: the model is told to emit bare lines, but it may still
 *  add bullets or numbering, so those get stripped the same way simple mode
 *  strips them. Throws when nothing usable comes back, which routes the caller
 *  through the normal fallback path rather than showing an empty task list. */
export function parseSmartTaskList(response: string): string[] {
  const lines = splitTaskBlob(response)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length <= MAX_TASK_LENGTH)
    .slice(0, MAX_TASKS);

  if (lines.length === 0) throw new Error('No tasks in smart response.');
  return lines;
}

/** §10.2 task-blob splitting. Smart mode cleans up wording and drops junk;
 *  simple mode splits on line breaks. Same "split" button either way — the
 *  caller renders `value` and shows `note` if one came back. */
export async function splitTaskBlobSmart(
  storage: LocalStorage,
  provider: AiProvider,
  blob: string,
): Promise<SmartResult<string[]>> {
  return withSmartFallback(
    storage,
    provider,
    { system: SYSTEM_PROMPT, user: blob, maxTokens: 1024 },
    parseSmartTaskList,
    () => splitTaskBlob(blob),
  );
}
