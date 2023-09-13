import type { Key, StoreNames } from '@indb/database';
import { getKeyPathValue } from '@indb/database';
import BaseSlice from './baseSlice';
import type { BaseSliceArgs } from './baseSlice';
import Collection from './collection';
import type { Comparer } from './types';

interface OrderedSliceArgs<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> extends BaseSliceArgs<Tables, StoreName> {
  compare: Tables[StoreName] extends object
    ? Comparer<Tables[StoreName]>
    : never;
}

/**
 * This class synchronizes an in-memory `Collection` with an IndexedDB objectStore. This class can
 * be used with React's `useSyncExternalStore`.
 *
 * It sets event handlers on the `Database` instance and handles events to keep the `Collection`
 * synchronized.
 *
 * If you give it an `IndexFilter` it will stay focused on those items whose value matches the
 * index value.
 */
export default class OrderedSlice<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> extends BaseSlice<Tables, StoreName> {
  private readonly collection: Collection<Tables[StoreName]>;

  constructor({ compare, ...baseArgs }: OrderedSliceArgs<Tables, StoreName>) {
    super(baseArgs);
    this.collection = new Collection(this.getKey, compare, []);
  }

  /**
   * Returns the collection data.
   *
   * This is declared as an arrow function so it can be passed directly to `useSyncExternalStore`;
   */
  getSnapshot = () => {
    // React requires that repeated calls to `getSnapshot` return the same object (determined
    // by `Object.is`) until the `subscribe` callback has been called. The collection implements
    // caching on its `toData` method to handle this.
    return this.collection.toData();
  };

  /**
   * Check to see if an item is in the index. If we are not working against an index then all items
   * will return true.
   */
  private isInIndex(obj: Tables[StoreName]): boolean {
    if (!this.index) {
      return true;
    }

    if (obj instanceof Object) {
      return getKeyPathValue(obj, this.index.path) === this.index.value;
    }

    return false;
  }

  /**
   * Decide how to change the collection with a created or updated item.
   */
  private changeInCollection(obj: Tables[StoreName]): boolean {
    // If the item is in the collection but its value does not now match the index, remove it from
    // the collection
    if (!this.isInIndex(obj)) {
      const key = this.getKey(obj);
      const inCollection = this.collection.has(key);

      if (inCollection) {
        this.collection.remove(key);
        return true;
      }
      return false;
    }

    this.collection.add(obj);
    return true;
  }

  /**
   * Add an item to the collection and dispatch a `changed` event.
   */
  protected override addToCollection(obj: Tables[StoreName]) {
    const changed = this.changeInCollection(obj);
    if (changed) {
      this.changeConnector.dispatchChanged();
    }
  }

  /**
   * Add many items to the collection and dispatch a `changed` event.
   */
  protected override addManyToCollection(objs: Array<Tables[StoreName]>) {
    const changed = objs
      .map((obj) => this.changeInCollection(obj))
      .some(Boolean);
    if (changed) {
      this.changeConnector.dispatchChanged();
    }
  }

  /**
   * Remove an item from the collection and dispatch a `changed` event.
   */
  protected override removeFromCollection(key: Key) {
    if (this.collection.has(key)) {
      this.collection.remove(key);
      this.changeConnector.dispatchChanged();
    }
  }

  /**
   * Get the initial items to use to populate the collection.
   */
  protected override async initializeCollection(): Promise<void> {
    let items: Array<Tables[StoreName]>;

    if (this.index) {
      const { path, value } = this.index;
      items = await this.database.getIndexAll(this.storeName, path, value);
    } else {
      items = await this.database.getAll(this.storeName);
    }

    this.collection.reset(items);
    this.changeConnector.dispatchChanged();
  }
}
