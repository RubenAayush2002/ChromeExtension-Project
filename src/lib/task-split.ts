const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * Simple-mode task-blob splitter: splits pasted multi-line text into tasks
 * by line break, stripping common list markers (-, *, •, "1.", "2)"). No AI.
 */
export function splitTaskBlob(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(LIST_MARKER, '').trim())
    .filter((line) => line.length > 0);
}
