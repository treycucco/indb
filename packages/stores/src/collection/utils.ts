import type { Comparer } from '../types.js';

/**
 * Uses a binary search to find the insert index for an item in an array.
 */
export const getInsertIndex = <T>(
  compare: Comparer<T>,
  items: T[],
  item: T,
): number => {
  let lbound = 0;
  let ubound = items.length;
  let iterations = 0;

  if (ubound === 0) {
    return 0;
  }

  for (;;) {
    // Bail out in case we introduce a bug. This algorithm takes log2(n) iterations, so bailing at
    // length is sufficient
    if (++iterations > items.length) {
      throw new Error('Unable to find insert index');
    }

    const candidateIndex = Math.floor((lbound + ubound) / 2);
    const candidateComp = compare(item, items[candidateIndex]!);

    // If we're looking at the first index to insert, the item has to go either in either the first
    // or second position
    if (candidateIndex === 0) {
      if (candidateComp <= 0) {
        return 0;
      }
      return 1;
    }

    const prevComp = compare(items[candidateIndex - 1]!, item);

    // If this item sorts between the candidate index item and the previous item, then its
    // insert point is the candidate index.
    if (prevComp <= 0 && candidateComp <= 0) {
      return candidateIndex;
    }

    // If the lbound and ubound are only one away, then the next lbound and ubound will be the
    // same values, because floor((2n + 1)/2) === floor(n + 0.5) === n. This should only happen
    // if one of the bounds is at the edge of the list. If that's not the case then there's an
    // algorithm or data problem.
    if (ubound - lbound <= 1) {
      if (lbound === 0) {
        return 0;
      }
      if (ubound === items.length) {
        return items.length;
      }
      throw new Error('Unable to find insert index');
    }

    // If the item sorts less than the candidate, bring the upper bound down to the candidate.
    // Otherwise bring the lower bound up to the candidate.
    if (candidateComp < 0) {
      ubound = candidateIndex;
    } else {
      lbound = candidateIndex;
    }
  }
};

/**
 * Uses a binary search to find the index of an item in a list sorted by `compare`.
 */
export const findIndex = <T>(
  compare: Comparer<T>,
  items: T[],
  item: T,
): number | undefined => {
  let lbound = 0;
  let ubound = items.length;
  let iterations = 0;

  if (ubound === 0) {
    return undefined;
  }

  for (;;) {
    // Bail out in case we introduce a bug. This algorithm takes log2(n) iterations, so bailing at
    // length is sufficient
    if (iterations++ > items.length) {
      throw new Error('Unable to find item');
    }

    const candidateIndex = Math.floor((lbound + ubound) / 2);
    const comp = compare(item, items[candidateIndex]!);

    if (comp === 0) {
      return candidateIndex;
    }

    // If the difference in the bounds is one or less it means we weren't able to find the item.
    if (ubound - lbound <= 0) {
      return undefined;
    }

    if (comp < 0) {
      ubound = candidateIndex;
    } else {
      lbound = candidateIndex;
    }
  }
};
