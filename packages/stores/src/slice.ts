import type { Key, StoreNames } from '@indb/database';
import BaseSlice from './baseSlice';

/**
 * This class synchronizes an in-memory `Map` with an IndexedDB objectStore. This class can be used
 * with React's `useSyncExternalStore`.
 *
 * It sets event handlers on the `Database` instance and handles events to keep the `Map`
 * synchronized.
 *
 * If you give it an `IndexFilter` it will stay focused on those items whose value matches the
 * index value.
 */
export default class Slice<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> extends BaseSlice<Tables, StoreName> {
  private collection: Map<Key, Tables[StoreName]> = new Map();
  private dataCache: Record<Key, Tables[StoreName]> | null = null;

  /**
   * Returns the collection data.
   *
   * This is declared as an arrow function so it can be passed directly to `useSyncExternalStore`;
   */
  getSnapshot = () => {
    // React requires that repeated calls to `getSnapshot` return the same object (determined
    // by `Object.is`) until the `subscribe` callback has been called.
    if (this.dataCache === null) {
      this.dataCache = Object.fromEntries(this.collection.entries());
    }
    return this.dataCache;
  };

  /**
   * Add an item to the collection and dispatch a `changed` event.
   */
  protected override addToCollection(obj: Tables[StoreName]) {
    const changed = this.changeInCollection(obj);
    if (changed) {
      this.dataCache = null;
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
      this.dataCache = null;
      this.changeConnector.dispatchChanged();
    }
  }

  /**
   * Remove an item from the collection and dispatch a `changed` event.
   */
  protected override removeFromCollection(key: Key) {
    if (this.collection.has(key)) {
      this.collection.delete(key);
      this.dataCache = null;
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

    this.collection = new Map(
      items.map((obj): [Key, Tables[StoreName]] => [this.getKey(obj), obj]),
    );
    this.dataCache = null;
    this.changeConnector.dispatchChanged();
  }

  /**
   * Decide how to change the collection with a created or updated item.
   */
  private changeInCollection(obj: Tables[StoreName]): boolean {
    const key = this.getKey(obj);

    // If the item is in the collection but its value does not now match the index, remove it from
    // the collection
    if (!this.isInIndex(obj)) {
      const inCollection = this.collection.has(key);

      if (inCollection) {
        this.collection.delete(key);
        return true;
      }
      return false;
    }

    this.collection.set(key, obj);
    return true;
  }
}
