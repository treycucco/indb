import DatabaseChangeConnector from './databaseChangeConnector.js';
import type { EntityStatus } from './types.js';
import type {
  Database,
  DatabaseEvent,
  Key,
  KeyExtractor,
  StoreNames,
} from '@indb/database';

export interface EntityArgs<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> {
  database: Database<Tables>;
  storeName: StoreName;
  key: Key;
}

export default class Entity<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> {
  private readonly changeConnector: DatabaseChangeConnector<Tables>;
  private readonly database: Database<Tables>;
  private readonly storeName: StoreName;
  private readonly key: Key;
  private readonly getKey: KeyExtractor<Tables[StoreName]>;
  private snapshot: {
    status: EntityStatus;
    entity: Tables[StoreName] | undefined;
  };

  constructor({ database, storeName, key }: EntityArgs<Tables, StoreName>) {
    this.changeConnector = new DatabaseChangeConnector(database);
    this.database = database;
    this.storeName = storeName;
    this.key = key;
    this.getKey = database.getKeyExtractor(storeName);
    this.snapshot = { status: 'LOADING', entity: undefined };
  }

  /**
   * Sets up the entity:
   *
   * It registers a listener with the database for changes to the store, and initializes the
   * internal representation.
   *
   * This method is safe to call repeatedly, but will only run the setup once between calls to
   * `teardown`.
   */
  async setup() {
    return this.changeConnector.setup(
      this.initializeEntity.bind(this),
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
   * Subscribes the callback to a `changed` event, which gets dispatched whenever the entity is
   * updated.
   *
   * This is declared as an arrow function so it can be passed directly to `useSyncExternalStore`;
   */
  subscribe = (callback: () => void) => {
    return this.changeConnector.subscribe(callback);
  };

  /**
   * Returns the entity.
   *
   * This is declared as an arrow function so it can be passed directly to `useSyncExternalStore`;
   */
  getSnapshot = () => {
    return this.snapshot;
  };

  /**
   * This is an event handler for `Database` changed events. It will use the information in the
   * handler to keep the entity synchronized.
   */
  private databaseChangedHandler(event: DatabaseEvent) {
    const { detail } = event;

    // We receive events for all stores. So filter out events that are for other stores.
    if (detail.storeName !== this.storeName) {
      return;
    }

    let changed = false;

    for (const change of detail.changes) {
      if (change.type === 'created' || change.type === 'updated') {
        const obj = change.obj as Tables[StoreName];

        if (this.getKey(obj) === this.key) {
          this.snapshot = { status: 'FOUND', entity: obj };
          changed = true;
        }
      } else if (change.type === 'deleted') {
        if (change.key === this.key) {
          this.snapshot = { status: 'NOT_FOUND', entity: undefined };
          changed = true;
        }
      } else {
        throw new Error(`Unhandled change type: ${change.type}`);
      }
    }

    if (changed) {
      this.changeConnector.dispatchChanged();
    }
  }

  private async initializeEntity(): Promise<void> {
    const entity = await this.database.get(this.storeName, this.key);
    this.snapshot = {
      status: entity ? 'FOUND' : 'NOT_FOUND',
      entity,
    };
    this.changeConnector.dispatchChanged();
  }
}
