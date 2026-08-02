import { describe, it, expect } from 'vitest';
import { labelForUrl } from '../bookmark-labels';

describe('labelForUrl', () => {
  it('capitalizes the main domain segment', () => {
    expect(labelForUrl('https://github.com/foo')).toBe('Github');
  });

  it('strips a leading www.', () => {
    expect(labelForUrl('https://www.github.com/foo')).toBe('Github');
  });

  it('handles multi-part TLDs by taking the first segment', () => {
    expect(labelForUrl('https://news.example.co.uk/story')).toBe('News');
  });

  it('returns "Other" for unparseable urls', () => {
    expect(labelForUrl('not a url')).toBe('Other');
  });
});
