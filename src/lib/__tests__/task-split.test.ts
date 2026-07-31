import { describe, it, expect } from 'vitest';
import { splitTaskBlob } from '../task-split';

describe('splitTaskBlob', () => {
  it('splits plain line breaks', () => {
    expect(splitTaskBlob('buy milk\ncall dentist\nfinish report')).toEqual([
      'buy milk',
      'call dentist',
      'finish report',
    ]);
  });

  it('strips dash and asterisk list markers', () => {
    expect(splitTaskBlob('- buy milk\n* call dentist\n• finish report')).toEqual([
      'buy milk',
      'call dentist',
      'finish report',
    ]);
  });

  it('strips numeric markers with dot or paren', () => {
    expect(splitTaskBlob('1. buy milk\n2) call dentist')).toEqual(['buy milk', 'call dentist']);
  });

  it('drops empty/whitespace-only lines', () => {
    expect(splitTaskBlob('buy milk\n\n   \ncall dentist')).toEqual(['buy milk', 'call dentist']);
  });

  it('handles CRLF line endings', () => {
    expect(splitTaskBlob('buy milk\r\ncall dentist')).toEqual(['buy milk', 'call dentist']);
  });

  it('returns an empty array for blank input', () => {
    expect(splitTaskBlob('   \n  \n')).toEqual([]);
  });
});
