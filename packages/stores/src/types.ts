import type { Key, StoreNames, ValidKeyPaths } from '@indb/database';

export type Comparer<T> = (left: T, right: T) => number;

export type IndexFilter<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> = {
  path: ValidKeyPaths<Tables[StoreName]>;
  value: Key;
};
