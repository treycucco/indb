import type { Predicate } from './types.js';
import type { CursorIteratorValue } from '@indb/database';

export const filteredArrayFromCursor = async <T>(
  iterator: AsyncIterable<CursorIteratorValue<T>>,
  predicate: Predicate<T>,
): Promise<T[]> => {
  const items: T[] = [];

  for await (const item of iterator) {
    if (predicate(item.obj)) {
      items.push(item.obj);
    }
  }

  return items;
};

export const filteredCountFromCursor = async <T>(
  iterator: AsyncIterable<CursorIteratorValue<T>>,
  predicate: Predicate<T>,
): Promise<number> => {
  let count = 0;

  for await (const item of iterator) {
    if (predicate(item.obj)) {
      count += 1;
    }
  }

  return count;
};
