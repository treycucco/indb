import type { TransactionChange } from './change';
import Deferred from './deferred';
import type { Key, ValidKeyPaths } from './keyPath';
import type { StoreNames } from './schema';

export default class Transaction<Tables> {
  private readonly transaction: IDBTransaction;
  private readonly deferred: Deferred<void> = new Deferred();
  private readonly _changes: TransactionChange[] = [];

  constructor(transaction: IDBTransaction) {
    this.transaction = transaction;
    this.transaction.onerror = () =>
      this.deferred.reject(this.transaction.error);
    this.transaction.oncomplete = () => this.deferred.resolve();
  }

  get promise() {
    return this.deferred.promise;
  }

  get changes() {
    return [...this._changes];
  }

  /**
   * Get an object by key from an object store.
   */
  async get<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    key: Key,
  ): Promise<Tables[StoreName] | undefined> {
    return this.getFromStoreOrIndex(this.store(storeName), key);
  }

  /**
   * Get all objects in an object store.
   */
  async getAll<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
  ): Promise<Array<Tables[StoreName]>> {
    const store = this.store(storeName);
    const request = store.getAll();

    return new Promise<Array<Tables[StoreName]>>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve((request.result ?? []) as Array<Tables[StoreName]>);
      };
    });
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
    const { index } = await this.index(storeName, indexName);
    return this.getFromStoreOrIndex(index, key);
  }

  /**
   * Get all values from an index that match a key value.
   */
  async getIndexAll<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
    key: Key,
  ): Promise<Array<Tables[StoreName]>> {
    const { index } = await this.index(storeName, indexName);
    const request = index.getAll(key);

    return new Promise<Array<Tables[StoreName]>>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve(request.result ?? ([] as Array<Tables[StoreName]>));
    });
  }

  /**
   * Get the count of objects in an object store.
   */
  async getCount<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
  ): Promise<number> {
    const store = await this.store(storeName);
    const request = store.count();

    return new Promise<number>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get the count of objects in an index that match a key value.
   */
  async getIndexCount<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
    key: Key,
  ): Promise<number> {
    const { index } = await this.index(storeName, indexName);
    const request = index.count(key);

    return new Promise<number>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Gets an object by key from an object store.
   */
  private getFromStoreOrIndex<ObjectType, KeyType extends Key>(
    storeOrIndex: IDBObjectStore | IDBIndex,
    key: KeyType,
  ): Promise<ObjectType | undefined> {
    const request = storeOrIndex.get(key);

    return new Promise<ObjectType | undefined>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(
          request.result === undefined
            ? undefined
            : (request.result as ObjectType),
        );
      };
    });
  }

  /**
   * Fully replace an object in an object store.
   *
   * Assumes the object didn't exist and dispatches the 'created' event. If you are not sure if
   * the object exists or not, and you want to get an event based on whether or not it exists, use
   * the `upsert` method.
   */
  put<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    obj: Tables[StoreName],
  ) {
    const store = this.store(storeName);

    store.put(obj);

    this._changes.push({
      type: 'created',
      storeName,
      obj,
    });
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
    const store = await this.store(storeName);

    const obj = await this.getFromStoreOrIndex<Tables[StoreName], typeof key>(
      store,
      key,
    );

    if (obj === undefined) {
      return undefined;
    }

    const updated = { ...obj, ...updates } as Tables[StoreName];

    store.put(updated);

    this._changes.push({
      type: 'updated',
      storeName,
      obj: updated,
    });

    return updated;
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
    const store = this.store(storeName);
    const exists = Boolean(
      await this.getFromStoreOrIndex<Tables[StoreName], typeof key>(store, key),
    );

    store.put(obj);

    this._changes.push({
      type: exists ? 'updated' : 'created',
      storeName,
      obj,
    });

    return obj;
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
    const store = await this.store(storeName);

    store.delete(key);

    this._changes.push({
      type: 'deleted',
      storeName,
      key,
    });
  }

  /**
   * Get a store by name from the transaction.
   */
  private store<StoreName extends StoreNames<Tables>>(storeName: StoreName) {
    return this.transaction.objectStore(storeName);
  }

  /**
   * Get an index by name from a store.
   */
  private index<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
  ) {
    const store = this.store(storeName);
    const index = store.index(indexName);

    return { store, index };
  }
}