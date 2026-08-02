import { describe, it, expect } from 'vitest';
import { extractArticle, estimatedReadingMinutes } from '../reading-extract';

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const LONG_PARAGRAPH =
  'This is a long paragraph of real article content that should be recognized as the main body text of the page. '.repeat(
    4,
  );

describe('extractArticle', () => {
  it('extracts the article content and title from a well-structured page', () => {
    const doc = parseHtml(`
      <html><head><title>Fallback Title</title></head><body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <article>
          <h1>Real Article Title</h1>
          <p>${LONG_PARAGRAPH}</p>
          <p>${LONG_PARAGRAPH}</p>
        </article>
        <footer>Copyright 2024</footer>
      </body></html>
    `);
    const result = extractArticle(doc);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Real Article Title');
    expect(result!.contentHtml).toContain('real article content');
    expect(result!.wordCount).toBeGreaterThan(0);
  });

  it('falls back to document.title when no h1 exists', () => {
    const doc = parseHtml(`
      <html><head><title>Fallback Title</title></head><body>
        <main><p>${LONG_PARAGRAPH}</p><p>${LONG_PARAGRAPH}</p></main>
      </body></html>
    `);
    expect(extractArticle(doc)!.title).toBe('Fallback Title');
  });

  it('returns null for a page with no article-like structure (nav-only page)', () => {
    const doc = parseHtml(`
      <html><body>
        <nav><a href="/1">Link one</a><a href="/2">Link two</a><a href="/3">Link three</a></nav>
      </body></html>
    `);
    expect(extractArticle(doc)).toBeNull();
  });

  it('returns null when the best candidate is too short to be a real article', () => {
    const doc = parseHtml(`<html><body><div><p>Too short.</p></div></body></html>`);
    expect(extractArticle(doc)).toBeNull();
  });

  it('prefers a low-link-density content block over a link-heavy nav of similar text length', () => {
    const linkHeavy = Array.from({ length: 20 }, (_, i) => `<a href="/${i}">Link number ${i} with some text</a>`).join(
      ' ',
    );
    const doc = parseHtml(`
      <html><body>
        <nav>${linkHeavy}</nav>
        <article><p>${LONG_PARAGRAPH}</p><p>${LONG_PARAGRAPH}</p></article>
      </body></html>
    `);
    const result = extractArticle(doc);
    expect(result!.contentHtml).toContain('real article content');
  });
});

describe('estimatedReadingMinutes', () => {
  it('computes minutes from word count at 200wpm, rounding to nearest minute', () => {
    expect(estimatedReadingMinutes(200)).toBe(1);
    expect(estimatedReadingMinutes(400)).toBe(2);
    expect(estimatedReadingMinutes(1000)).toBe(5);
  });

  it('always returns at least 1 minute for a non-empty article', () => {
    expect(estimatedReadingMinutes(10)).toBe(1);
  });
});
