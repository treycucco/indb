import type {
  Database,
  DatabaseEvent,
  Key,
  KeyExtractor,
  StoreNames,
} from '@indb/database';
import DatabaseChangeConnector from './databaseChangeConnector';
import type { IndexFilter } from './types';

export interface BaseSliceArgs<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> {
  database: Database<Tables>;
  storeName: StoreName;
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
export default abstract class BaseSlice<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> {
  protected readonly changeConnector: DatabaseChangeConnector<Tables>;
  protected readonly storeName: StoreName;
  protected readonly database: Database<Tables>;
  protected readonly index: IndexFilter<Tables, StoreName> | undefined;
  protected readonly getKey: KeyExtractor<Tables[StoreName]>;

  constructor({
    database,
    storeName,
    index,
  }: BaseSliceArgs<Tables, StoreName>) {
    this.changeConnector = new DatabaseChangeConnector(database);
    this.database = database;
    this.storeName = storeName;
    this.index = index;
    this.getKey = database.getKeyExtractor(storeName);
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
   * Add an item to the collection and dispatch a `changed` event.
   */
  protected abstract addToCollection(obj: Tables[StoreName]): void;

  /**
   * Add many items to the collection and dispatch a `changed` event.
   */
  protected abstract addManyToCollection(objs: Array<Tables[StoreName]>): void;

  /**
   * Remove an item from the collection and dispatch a `changed` event.
   */
  protected abstract removeFromCollection(key: Key): void;

  /**
   * Get the initial items to use to populate the collection.
   */
  protected abstract initializeCollection(): Promise<void>;
}
