import { describe, it, expect } from 'vitest';
import { extractOpeningLines } from '../opening-lines';

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('extractOpeningLines', () => {
  it('extracts the first meaningful paragraph, ignoring nav/header/footer', () => {
    const doc = parseHtml(`
      <html><body>
        <header><p>Site Navigation Links Here</p></header>
        <article>
          <p>This is the real opening paragraph of the article, long enough to count as meaningful content for the preview.</p>
        </article>
        <footer><p>Copyright footer text</p></footer>
      </body></html>
    `);
    expect(extractOpeningLines(doc)).toContain('real opening paragraph');
  });

  it('skips short/junk paragraphs under the minimum length', () => {
    const doc = parseHtml(`
      <html><body>
        <p>Hi</p>
        <p>This is a properly long paragraph that should be picked up as the actual opening content of the page.</p>
      </body></html>
    `);
    expect(extractOpeningLines(doc)).toContain('properly long paragraph');
  });

  it('truncates very long paragraphs with an ellipsis', () => {
    const longText = 'word '.repeat(100).trim();
    const doc = parseHtml(`<html><body><p>${longText}</p></body></html>`);
    const result = extractOpeningLines(doc);
    expect(result?.endsWith('…')).toBe(true);
    expect(result!.length).toBeLessThanOrEqual(201);
  });

  it('returns null when no meaningful paragraph exists', () => {
    const doc = parseHtml(`<html><body><nav><p>Home About Contact</p></nav></body></html>`);
    expect(extractOpeningLines(doc)).toBeNull();
  });
});
