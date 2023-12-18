import { findIndex, getInsertIndex } from './utils.js';
import { describe, expect, test } from 'vitest';

const compare = (left: number, right: number) => left - right;

describe(getInsertIndex, () => {
  test('empty array', () => {
    expect(getInsertIndex(compare, [], 0)).toBe(0);
    expect(getInsertIndex(compare, [], 1_000)).toBe(0);
  });

  test('one item in array', () => {
    expect(getInsertIndex(compare, [1], 0)).toBe(0);
    expect(getInsertIndex(compare, [1], 2)).toBe(1);
  });

  test('multiple items in array', () => {
    const items = [2, 4, 6, 8, 10];

    expect(getInsertIndex(compare, items, 0)).toBe(0);
    expect(getInsertIndex(compare, items, 1)).toBe(0);
    expect(getInsertIndex(compare, items, 3)).toBe(1);
    expect(getInsertIndex(compare, items, 5)).toBe(2);
    expect(getInsertIndex(compare, items, 7)).toBe(3);
    expect(getInsertIndex(compare, items, 9)).toBe(4);
    expect(getInsertIndex(compare, items, 11)).toBe(5);
  });
});

describe(findIndex, () => {
  test('empty array', () => {
    expect(findIndex(compare, [], 1)).toBeUndefined();
  });

  test('one item in array', () => {
    expect(findIndex(compare, [1], 1)).toBe(0);
    expect(findIndex(compare, [5], 1)).toBeUndefined();
  });

  describe('many items in array', () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    test.each(items)('inserting value %i', (item) => {
      // Each item is also its index
      expect(findIndex(compare, items, item)).toBe(item);
    });
  });
});
