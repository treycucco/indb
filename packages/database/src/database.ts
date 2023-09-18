import type { StoreChanges, TransactionChange } from './change';
import { mapTransactionChangesToStoreChanges } from './change';
import { getKeyPathValue } from './keyPath';
import type { Key, KeyExtractor, ValidKeyPaths } from './keyPath';
import type { SchemaDefinition, StoreNames } from './schema';
import { migrateSchema } from './schema';
import Transaction from './transaction';

export type DatabaseEvent = CustomEvent<StoreChanges>;

/**
 * This class provides a convenient (thought limited) API on top of IndexedDB.
 *
 * In addition to the API, it acts as an EventTarget for changes to the underlying database that
 * occur through instances of the class. This means that listeners can be notified of changes to
 * the underlying data after they happen.
 *
 * Additionally, instances of this class subscribe to and dispatch events on a BroadcastChannel
 * related to the database and re-raise those events to their listeners. So no matter where changes
 * to the data occurs, listeners can be notified.
 */
export default class Database<Tables> {
  private openPromise: Promise<IDBDatabase> | null = null;
  private db: IDBDatabase | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private readonly eventTarget = new EventTarget();
  private readonly name: string;
  private readonly schema: SchemaDefinition<Tables>;

  constructor(name: string, schema: SchemaDefinition<Tables>) {
    this.name = name;
    this.schema = schema;
  }

  get isOpen(): boolean {
    return Boolean(this.db);
  }

  get isClosed(): boolean {
    return !this.isOpen;
  }

  /**
   * Open the database.
   *
   * The promise will resolve after migrations have been run.
   */
  open(): Promise<IDBDatabase> {
    if (this.openPromise) {
      return this.openPromise;
    }

    const targetVersion = this.schema.version;
    const openRequest = indexedDB.open(this.name, targetVersion);

    this.openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onerror = () => {
        reject(openRequest.error);
      };

      openRequest.onsuccess = () => {
        const db = openRequest.result;

        db.onversionchange = () => {
          this.close();
        };

        this.db = db;
        this.subscribeToBroadcastChannel();

        // Resolve the promise if the database's version matches the target version. If the version
        // does not match that means `onupgradeneeded` will be called, and we will resolve when
        // that is done instead.
        if (db.version === targetVersion) {
          resolve(db);
        }
      };

      openRequest.onupgradeneeded = (event) => {
        // console.debug(
        //   `Migrating from ${event.oldVersion} to ${event.newVersion}`,
        // );

        const transaction = openRequest.transaction!;

        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => {
          // console.debug('Finished migrating to new version');
          resolve(openRequest.result);
        };

        migrateSchema(openRequest.transaction!, this.schema, event.oldVersion);
      };
    });

    return this.openPromise;
  }

  /**
   * Close the database.
   *
   * This method will be called internally if a database in another tab / window opens and needs to
   * upgrade. However, it will not unsubscribe from the broadcast channel so subscribers will
   * continue to get updates from other tabs / windows.
   *
   * All methods that need to work with the database first call `await open` so it's OK to call
   * this at any time.
   *
   * If you pass `true` to unsubscribe it will unsubscribe from the broadcast channel. You should
   * only do that when you are going to dispose of the instance.
   */
  close(unsubscribe = false) {
    if (this.isClosed) {
      throw new Error('Cannot call close when the database is not open');
    }

    if (unsubscribe) {
      this.unsubscribeFromBroadcastChannel();
    }
    this.db!.close();
    this.openPromise = null;
    this.db = null;
  }

  async transaction(
    storeNames: StoreNames<Tables>[],
    mode: IDBTransactionMode = 'readonly',
  ): Promise<Transaction<Tables>> {
    const db = await this.open();
    const transaction = new Transaction<Tables>(
      db.transaction(storeNames, mode),
    );

    transaction.promise.then(() => this.dispatchChanges(transaction.changes));

    return transaction;
  }

  /**
   * Get an object by key from an object store.
   */
  async get<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    key: Key,
  ): Promise<Tables[StoreName] | undefined> {
    const transaction = await this.transaction([storeName], 'readonly');
    return transaction.get(storeName, key);
  }

  /**
   * Get all objects in an object store.
   */
  async getAll<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
  ): Promise<Array<Tables[StoreName]>> {
    const transaction = await this.transaction([storeName], 'readonly');
    return transaction.getAll(storeName);
  }

  /**
   * Get an object by key from an index.
   *
   * If the index is unique it will return the value. If multiple items match the key for the
   * index this will only return the first item.
   *
   * If multiple items do match the key, you should use `getIndexAll` instead.
   */
  async getIndex<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
    key: Key,
  ): Promise<Tables[StoreName] | undefined> {
    const transaction = await this.transaction([storeName], 'readonly');
    return transaction.getIndex(storeName, indexName, key);
  }

  /**
   * Get all values from an index that match a key value.
   */
  async getIndexAll<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
    key: Key,
  ): Promise<Array<Tables[StoreName]>> {
    const transaction = await this.transaction([storeName], 'readonly');
    return transaction.getIndexAll(storeName, indexName, key);
  }

  /**
   * Get the count of objects in an object store.
   */
  async getCount<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
  ): Promise<number> {
    const transaction = await this.transaction([storeName], 'readonly');
    return transaction.getCount(storeName);
  }

  /**
   * Get the count of objects in an index that match a key value.
   */
  async getIndexCount<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
    key: Key,
  ): Promise<number> {
    const transaction = await this.transaction([storeName], 'readonly');
    return transaction.getIndexCount(storeName, indexName, key);
  }

  /**
   * Fully replace an object in an object store.
   *
   * Assumes the object didn't exist and dispatches the 'created' event. If you are not sure if
   * the object exists or not, and you want to get an event based on whether or not it exists, use
   * the `upsert` method.
   */
  async put<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    obj: Tables[StoreName],
  ): Promise<void> {
    const transaction = await this.transaction([storeName], 'readwrite');

    transaction.put(storeName, obj);

    return transaction.promise;
  }

  /**
   * Fully replace multiple objects in an object store.
   *
   * Similar to `#put` but works on an array of items in a single transaction.
   */
  async putMany<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    objs: Array<Tables[StoreName]>,
  ): Promise<void> {
    const transaction = await this.transaction([storeName], 'readwrite');

    objs.forEach((obj) => transaction.put(storeName, obj));

    return transaction.promise;
  }

  /**
   * Update some fields of an object in an object store.
   *
   * Returns undefined if no object with that key was found.
   *
   * Dispatches the 'updated' event if the object was found, no event if not.
   */
  async update<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    key: Key,
    updates: Partial<Tables[StoreName]>,
  ): Promise<Tables[StoreName] | undefined> {
    const transaction = await this.transaction([storeName], 'readwrite');
    const updated = transaction.update(storeName, key, updates);

    return transaction.promise.then(() => updated);
  }

  /**
   * Insert or update an object in an object store.
   *
   * This method checks for the existence of the object before inserting, and will dispatch an
   * event based on what it finds, either 'created' if not object was found or 'updated' if an
   * object was found.
   */
  async upsert<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    key: Key,
    obj: Tables[StoreName],
  ): Promise<Tables[StoreName]> {
    const transaction = await this.transaction([storeName], 'readwrite');
    const result = transaction.upsert(storeName, key, obj);

    return transaction.promise.then(() => result);
  }

  /**
   * Delete a object identified by a key.
   *
   * Dispatches the 'deleted' event whether or not the object existed in the store.
   */
  async delete<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    key: Key,
  ): Promise<void> {
    const transaction = await this.transaction([storeName], 'readwrite');

    transaction.delete(storeName, key);

    return transaction.promise;
  }

  /**
   * Returns a `KeyExtractor` for the type related to the `storeName`.
   *
   * The `KeyExtractor` uses the `keyPath` from the schema for the store name.
   */
  getKeyExtractor<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
  ): KeyExtractor<Tables[StoreName]> {
    return (obj): Key => {
      if (obj instanceof Object) {
        return getKeyPathValue(obj, this.schema.stores[storeName].keyPath);
      }
      throw new Error(`Values in ${storeName} are invalid`);
    };
  }

  /**
   * Attaches an event listener to the database's `EventTarget`.
   */
  addEventListener(type: 'changed', callback: (event: DatabaseEvent) => void) {
    const handler = (event: Event) => callback(event as DatabaseEvent);

    this.eventTarget.addEventListener(type, handler);

    return () => this.eventTarget.removeEventListener(type, handler);
  }

  private dispatchChanges(transactionChanges: TransactionChange[]) {
    const storeChanges =
      mapTransactionChangesToStoreChanges(transactionChanges);
    storeChanges.forEach((storeChange) => this.dispatch(storeChange));
  }

  private dispatch(data: StoreChanges, broadcast = true) {
    this.eventTarget.dispatchEvent(
      new CustomEvent<StoreChanges>('changed', { detail: data }),
    );

    if (broadcast) {
      this.broadcastChannel?.postMessage(data);
    }
  }

  /**
   * Sets up a `BroadcastChannel` and subscribes to database change events coming through it.
   */
  private subscribeToBroadcastChannel() {
    if (!this.broadcastChannel && 'BroadcastChannel' in globalThis) {
      this.broadcastChannel = new BroadcastChannel(`IndexedDB:${this.name}`);
      this.broadcastChannel.onmessage = (event) => {
        this.dispatch(event.data as StoreChanges, false);
      };
    }
  }

  /**
   * Unsubscribes from `BroadcastChannel` events.
   */
  private unsubscribeFromBroadcastChannel() {
    this.broadcastChannel?.close();
    this.broadcastChannel = null;
  }
}

/**
 * Deletes a database.
 */
export const deleteDatabase = (name: string): Promise<void> => {
  const request = indexedDB.deleteDatabase(name);

  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
