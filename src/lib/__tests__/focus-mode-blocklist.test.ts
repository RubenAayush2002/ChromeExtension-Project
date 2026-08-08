import { describe, it, expect } from 'vitest';
import { isHostBlocked, isUrlBlocked } from '../focus-mode-blocklist';

describe('isHostBlocked', () => {
  it('matches an exact hostname', () => {
    expect(isHostBlocked('twitter.com', ['twitter.com'])).toBe(true);
  });

  it('matches a subdomain of a blocklisted host', () => {
    expect(isHostBlocked('mail.example.com', ['example.com'])).toBe(true);
  });

  it('treats a www. prefix as equivalent on both sides', () => {
    expect(isHostBlocked('www.twitter.com', ['twitter.com'])).toBe(true);
    expect(isHostBlocked('twitter.com', ['www.twitter.com'])).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isHostBlocked('Twitter.com', ['twitter.com'])).toBe(true);
  });

  it('does not match an unrelated host', () => {
    expect(isHostBlocked('example.com', ['twitter.com'])).toBe(false);
  });

  it('does not match a host that merely contains the blocklisted string as a substring', () => {
    expect(isHostBlocked('nottwitter.com', ['twitter.com'])).toBe(false);
  });

  it('returns false for an empty blocklist', () => {
    expect(isHostBlocked('twitter.com', [])).toBe(false);
  });
});

describe('isUrlBlocked', () => {
  it('extracts the hostname from a full url and checks it', () => {
    expect(isUrlBlocked('https://www.twitter.com/home', ['twitter.com'])).toBe(true);
  });

  it('returns false for an unparseable url', () => {
    expect(isUrlBlocked('not a url', ['twitter.com'])).toBe(false);
  });
});
