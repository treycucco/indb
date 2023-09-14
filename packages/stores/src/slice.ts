import type {
  Database,
  DatabaseEvent,
  Key,
  KeyExtractor,
  StoreNames,
} from '@indb/database';
import { getKeyPathValue } from '@indb/database';
import Collection from './collection';
import DatabaseChangeConnector from './databaseChangeConnector';
import type { Comparer, IndexFilter } from './types';

export interface BaseSliceArgs<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> {
  database: Database<Tables>;
  storeName: StoreName;
  compare: Tables[StoreName] extends object
    ? Comparer<Tables[StoreName]>
    : never;
  index?: IndexFilter<Tables, StoreName>;
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
export default class Slice<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> {
  private readonly changeConnector: DatabaseChangeConnector<Tables>;
  private readonly storeName: StoreName;
  private readonly database: Database<Tables>;
  private readonly index: IndexFilter<Tables, StoreName> | undefined;
  private readonly getKey: KeyExtractor<Tables[StoreName]>;
  private readonly collection: Collection<Tables[StoreName]>;

  constructor({
    database,
    storeName,
    compare,
    index,
  }: BaseSliceArgs<Tables, StoreName>) {
    this.changeConnector = new DatabaseChangeConnector(database);
    this.database = database;
    this.storeName = storeName;
    this.index = index;
    this.getKey = database.getKeyExtractor(storeName);
    this.collection = new Collection(this.getKey, compare, []);
  }

  /**
   * Sets up the slice:
   *
   * It registers a listener with the database for changes to the store, and initializes the
   * internal collection.
   *
   * This method is safe to call repeatedly, but will only run the setup once between calls to
   * `teardown`.
   */
  async setup() {
    return this.changeConnector.setup(
      this.initializeCollection.bind(this),
      this.databaseChangedHandler.bind(this),
    );
  }

  /**
   * Deregisters the database listener.
   */
  teardown() {
    this.changeConnector.teardown();
  }

  /**
   * Subscribes the callback to a `changed` event, which gets dispatched whenever the slice updates
   * the underlying Collection.
   *
   * This is declared as an arrow function so it can be passed directly to `useSyncExternalStore`;
   */
  subscribe = (callback: () => void) => {
    return this.changeConnector.subscribe(callback);
  };

  /**
   * This is an event handler for `Database` changed events. It will use the information in the
   * handler to keep the `Collectionn` synchronized.
   */
  private databaseChangedHandler(event: DatabaseEvent) {
    const { detail } = event;

    // We receive events for all stores. So filter out events that are for other stores.
    //
    // If we're focused on an index, the index checking will occur later, because if an item was
    // updated so that it is no longer in the index we will have to remove it rather than
    // updating it.
    if (detail.storeName !== this.storeName) {
      return;
    }

    switch (detail.type) {
      case 'created':
      case 'updated':
        this.addToCollection(detail.obj as Tables[StoreName]);
        break;
      case 'createdMany':
        this.addManyToCollection(detail.objs as Array<Tables[StoreName]>);
        break;
      case 'deleted':
        this.removeFromCollection(detail.key);
        break;
      default:
        throw new Error('Unhandled event type');
    }
  }

  /**
   * Check to see if an item is in the index. If we are not working against an index then all items
   * will return true.
   */
  protected isInIndex(obj: Tables[StoreName]): boolean {
    if (!this.index) {
      return true;
    }

    if (obj instanceof Object) {
      return getKeyPathValue(obj, this.index.path) === this.index.value;
    }

    return false;
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
   * Add an item to the collection and dispatch a `changed` event.
   */
  private addToCollection(obj: Tables[StoreName]) {
    const changed = this.changeInCollection(obj);
    if (changed) {
      this.changeConnector.dispatchChanged();
    }
  }

  /**
   * Add many items to the collection and dispatch a `changed` event.
   */
  private addManyToCollection(objs: Array<Tables[StoreName]>) {
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
  private removeFromCollection(key: Key) {
    if (this.collection.has(key)) {
      this.collection.remove(key);
      this.changeConnector.dispatchChanged();
    }
  }

  /**
   * Get the initial items to use to populate the collection.
   */
  private async initializeCollection(): Promise<void> {
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
}
