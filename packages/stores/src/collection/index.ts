import type { Comparer } from '../types';
import { findIndex, getInsertIndex } from './utils';
import type { Key, KeyExtractor } from '@indb/database';

export type CollectionData<ObjectType> = {
  ids: Key[];
  index: Record<Key, ObjectType>;
};

/**
 * This class holds a collection of objects indexed by a key, and an array of their ids in sorted
 * order.
 *
 * All updates are done in-place, but the `toData` method provides a new object whenever the `ids`
 * or `index` changes.
 */
export default class Collection<ObjectType> {
  private ids: Array<Key> = [];
  private index = new Map<Key, ObjectType>();
  private dataCache: CollectionData<ObjectType> | null = null;
  private readonly getKey: KeyExtractor<ObjectType>;
  private readonly compare: Comparer<ObjectType>;

  constructor(
    getKey: KeyExtractor<ObjectType>,
    compare: Comparer<ObjectType>,
    objects: ObjectType[],
  ) {
    this.getKey = getKey;
    this.compare = compare;

    this.reset(objects);
  }

  /**
   * Returns the collection data as a plain old JavaScript object.
   *
   * Repeated calls to this function will return a stable value until the underlying data changes,
   * and then a new object will be returned.
   */
  toData(): CollectionData<ObjectType> {
    if (this.dataCache === null) {
      this.dataCache = {
        index: Object.fromEntries(this.index.entries()),
        ids: [...this.ids],
      };
    }
    return this.dataCache;
  }

  /**
   * Completely the data data in the collection.
   */
  reset(objects: ObjectType[]) {
    const pairs = objects.map((obj): [Key, ObjectType] => [
      this.getKey(obj),
      obj,
    ]);

    pairs.sort(([, left], [, right]) => this.compare(left, right));

    this.ids = pairs.map(([id]) => id);
    this.index = new Map(pairs);
    this.clearCache();
  }

  /**
   * Check to see if an object is in the collection.
   */
  has(key: Key): boolean {
    return this.index.has(key);
  }

  /**
   * Add or update a single object in the collection.
   *
   * If its sorting position changes due to an update its position in the ids array will be
   * be appropriately updated.
   */
  add(obj: ObjectType) {
    const key = this.getKey(obj);
    const existing = this.index.get(key);

    this.index.set(key, obj);

    if (existing === undefined) {
      const insertIndex = this.getInsertIndex(key);
      this.ids.splice(insertIndex, 0, key);
    } else {
      const removeIndex = this.ids.indexOf(key);
      this.ids.splice(removeIndex, 1);
      const insertIndex = this.getInsertIndex(key);
      this.ids.splice(insertIndex, 0, key);
    }

    this.clearCache();
  }

  /**
   * Remove an item from the collection by key.
   *
   * Returns true if the item was in the collection, false if not.
   */
  remove(key: Key): boolean {
    if (!this.index.has(key)) {
      return false;
    }

    const objIndex = this.findIndex(key);

    if (objIndex === undefined) {
      throw new Error(
        `Unable to find index for key ${key} that does exist in index`,
      );
    }

    this.index.delete(key);
    this.ids.splice(objIndex, 1);
    this.clearCache();

    return true;
  }

  private clearCache() {
    this.dataCache = null;
  }

  private getInsertIndex(key: Key): number {
    return getInsertIndex(this.compareByKey, this.ids, key);
  }

  private findIndex(key: Key): number | undefined {
    return findIndex(this.compareByKey, this.ids, key);
  }

  private compareByKey = (leftKey: Key, rightKey: Key): number => {
    const left = this.index.get(leftKey)!;
    const right = this.index.get(rightKey)!;

    return this.compare(left, right);
  };
}
