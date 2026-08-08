import { describe, it, expect } from 'vitest';
import { todaysTaskProgress } from '../focus-progress';

describe('todaysTaskProgress', () => {
  it('counts done vs total across all tasks', () => {
    expect(
      todaysTaskProgress([{ done: true }, { done: false }, { done: true }]),
    ).toEqual({ done: 2, total: 3 });
  });

  it('returns 0 of 0 for an empty list', () => {
    expect(todaysTaskProgress([])).toEqual({ done: 0, total: 0 });
  });

  it('returns 0 done when nothing is complete', () => {
    expect(todaysTaskProgress([{ done: false }, { done: false }])).toEqual({ done: 0, total: 2 });
  });
});
