import DatabaseChangeConnector from './databaseChangeConnector';
import type { IndexFilter, Predicate } from './types';
import { filteredCountFromCursor } from './utils';
import type { Database, DatabaseEvent, StoreNames } from '@indb/database';

type CounterArgs<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> = {
  database: Database<Tables>;
  storeName: StoreName;
  index?: IndexFilter<Tables, StoreName>;
  filter?: Predicate<Tables[StoreName]>;
};

/**
 * This class synchronizes an in-memory count with an IndexedDB objectStore. This class can
 * be used with React's `useSyncExternalStore`.
 *
 * It sets event handlers on the `Database` instance and handles events to keep the count
 * synchronized.
 *
 * If you give it an `IndexFilter` it will stay focused on those items whose value matches the
 * index value.
 */
export default class Counter<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> {
  private readonly changeConnector: DatabaseChangeConnector<Tables>;
  private readonly database: Database<Tables>;
  private readonly storeName: StoreName;
  private readonly index: IndexFilter<Tables, StoreName> | undefined;
  private readonly filter: Predicate<Tables[StoreName]> | null;
  private count: number | undefined = undefined;

  constructor({
    database,
    storeName,
    index,
    filter,
  }: CounterArgs<Tables, StoreName>) {
    this.changeConnector = new DatabaseChangeConnector(database);
    this.database = database;
    this.storeName = storeName;
    this.index = index;
    this.filter = filter ?? null;
  }

  /**
   * Sets up the counter:
   *
   * It registers a listener with the database for changes to the store, and initializes the
   * counter.
   *
   * This method is safe to call repeatedly, but will only run the setup once between calls to
   * `teardown`.
   */
  async setup() {
    return this.changeConnector.setup(
      this.updateCount.bind(this),
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
   * Subscribes the callback to a `changed` event, which gets dispatched whenever the counter
   * updates
   *
   * This is declared as an arrow function so it can be passed directly to `useSyncExternalStore`;
   */
  subscribe = (callback: () => void) => {
    return this.changeConnector.subscribe(callback);
  };

  /**
   * Returns the count in the objectStore or index with matching values.
   *
   * This is declared as an arrow function so it can be passed directly to `useSyncExternalStore`;
   */
  getSnapshot = () => {
    return this.count;
  };

  /**
   * This is an event handler for `Database` changed events. It will use the information in the
   * handler to keep the `Collectionn` synchronized.
   */
  private databaseChangedHandler(event: DatabaseEvent) {
    const { detail } = event;

    if (detail.storeName !== this.storeName) {
      return;
    }

    this.updateCount();
  }

  /**
   * Fetches the updated count for the objectStore or index and if it has changed, dispatches a
   * changed event.
   */
  private async updateCount() {
    let nextCount: number;

    if (this.index) {
      const { path, value } = this.index;
      if (this.filter) {
        nextCount = await filteredCountFromCursor(
          (await this.database.iterateIndex(this.storeName, path, value))
            .iterator,
          this.filter,
        );
      } else {
        nextCount = await this.database.getIndexCount(
          this.storeName,
          path,
          value,
        );
      }
    } else {
      if (this.filter) {
        nextCount = await filteredCountFromCursor(
          (await this.database.iterate(this.storeName)).iterator,
          this.filter,
        );
      } else {
        nextCount = await this.database.getCount(this.storeName);
      }
    }

    if (nextCount !== this.count) {
      this.count = nextCount;
      this.changeConnector.dispatchChanged();
    }
  }
}
