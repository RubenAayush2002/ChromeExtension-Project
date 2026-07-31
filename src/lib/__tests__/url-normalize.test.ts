import { describe, it, expect } from 'vitest';
import { normalizeUrl, areDuplicateUrls, extractHostname } from '../url-normalize';

describe('normalizeUrl', () => {
  it('strips utm_ and known tracking params', () => {
    const url = 'https://example.com/article?utm_source=x&utm_medium=y&fbclid=abc&id=42';
    expect(normalizeUrl(url)).toBe('https://example.com/article?id=42');
  });

  it('removes a trailing slash but keeps root path as-is', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('lowercases the host', () => {
    expect(normalizeUrl('https://Example.COM/Page')).toBe('https://example.com/Page');
  });

  it('sorts remaining query params for stable comparison', () => {
    const a = normalizeUrl('https://example.com/?b=2&a=1');
    const b = normalizeUrl('https://example.com/?a=1&b=2');
    expect(a).toBe(b);
  });

  it('returns the original string for unparseable input', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('areDuplicateUrls', () => {
  it('treats tracking-tail variants of the same article as duplicates', () => {
    const a = 'https://news.example.com/story?utm_source=twitter';
    const b = 'https://news.example.com/story';
    expect(areDuplicateUrls(a, b)).toBe(true);
  });

  it('does not treat different paths as duplicates', () => {
    expect(areDuplicateUrls('https://example.com/a', 'https://example.com/b')).toBe(false);
  });
});

describe('extractHostname', () => {
  it('extracts and lowercases the hostname', () => {
    expect(extractHostname('https://Sub.Example.COM/path')).toBe('sub.example.com');
  });

  it('returns null for unparseable input', () => {
    expect(extractHostname('not a url')).toBeNull();
  });
});
