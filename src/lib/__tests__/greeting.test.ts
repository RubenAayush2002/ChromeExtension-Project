import { describe, it, expect } from 'vitest';
import { timeOfDay, greetingText } from '../greeting';

describe('timeOfDay', () => {
  it('is morning from 5am up to (not including) noon', () => {
    expect(timeOfDay(5)).toBe('morning');
    expect(timeOfDay(11)).toBe('morning');
  });

  it('is afternoon from noon up to (not including) 6pm', () => {
    expect(timeOfDay(12)).toBe('afternoon');
    expect(timeOfDay(17)).toBe('afternoon');
  });

  it('is evening from 6pm onward, including night and pre-dawn hours', () => {
    expect(timeOfDay(18)).toBe('evening');
    expect(timeOfDay(23)).toBe('evening');
    expect(timeOfDay(0)).toBe('evening');
    expect(timeOfDay(4)).toBe('evening');
  });
});

describe('greetingText', () => {
  it('includes the name when provided', () => {
    expect(greetingText(9, 'Ruben')).toBe('Good morning, Ruben');
  });

  it('omits the trailing comma/name when name is blank', () => {
    expect(greetingText(9, '')).toBe('Good morning');
    expect(greetingText(9, '   ')).toBe('Good morning');
  });
});
