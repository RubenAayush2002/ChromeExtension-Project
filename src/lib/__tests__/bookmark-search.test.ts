import { describe, it, expect } from 'vitest';
import { keywordSearchBookmarks, type SearchableBookmark } from '../bookmark-search';

const bookmarks: SearchableBookmark[] = [
  { id: '1', title: 'GitHub', url: 'https://github.com', label: 'Github' },
  { id: '2', title: 'Best Pasta Recipe', url: 'https://recipes.example.com/pasta', label: 'Recipes' },
  { id: '3', title: 'Tax Documents 2024', url: 'https://irs.gov/forms', label: 'Irs' },
];

describe('keywordSearchBookmarks', () => {
  it('returns all bookmarks for an empty query', () => {
    expect(keywordSearchBookmarks('', bookmarks)).toEqual(bookmarks);
  });

  it('matches by title, case-insensitively', () => {
    expect(keywordSearchBookmarks('pasta', bookmarks).map((b) => b.id)).toEqual(['2']);
  });

  it('matches by url', () => {
    expect(keywordSearchBookmarks('irs.gov', bookmarks).map((b) => b.id)).toEqual(['3']);
  });

  it('matches by label', () => {
    expect(keywordSearchBookmarks('recipes', bookmarks).map((b) => b.id)).toEqual(['2']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(keywordSearchBookmarks('zzz-no-match', bookmarks)).toEqual([]);
  });
});
