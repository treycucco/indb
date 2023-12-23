import Deferred from './deferred.js';
import { describe, expect, test } from 'vitest';

describe(Deferred, () => {
  test('resolves correctly', async () => {
    const d = new Deferred<number>();

    setTimeout(() => d.resolve(4));

    const value = await d.promise;

    expect(value).toBe(4);
  });

  test('rejects correctly', () => {
    const d = new Deferred<number>();

    setTimeout(() => d.reject('Oh no'));

    expect(async () => await d.promise).rejects.toThrowError('Oh no');
  });
});
