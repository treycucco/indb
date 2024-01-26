import type { TransactionChange } from './change.js';
import Cursor from './cursor.js';
import type { CursorIteratorValue } from './cursor.js';
import Deferred from './deferred.js';
import type { Key, ValidKeyPaths } from './keyPath.js';
import type { StoreNames } from './schema.js';

export default class Transaction<Tables> {
  private readonly transaction: IDBTransaction;
  private readonly deferred: Deferred<void> = new Deferred();
  private readonly _changes: TransactionChange[] = [];

  constructor(transaction: IDBTransaction) {
    this.transaction = transaction;
    this.transaction.onabort = (event) => this.deferred.reject(event);
    this.transaction.onerror = (event) => this.deferred.reject(event);
    this.transaction.oncomplete = () => this.deferred.resolve();
  }

  get promise() {
    return this.deferred.promise;
  }

  get changes() {
    return [...this._changes];
  }

  /**
   * Get an object by key from an object store, or the first item in an key range.
   */
  async get<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    key: Key | IDBKeyRange,
  ): Promise<Tables[StoreName] | undefined> {
    return this.getFromStoreOrIndex(this.store(storeName), key);
  }

  /**
   * Get all objects in an object store, or all objects matching a key range.
   */
  async getAll<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    keyRange?: IDBKeyRange,
  ): Promise<Array<Tables[StoreName]>> {
    const store = this.store(storeName);
    const request = store.getAll(keyRange);

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
    key: Key | IDBKeyRange,
  ): Promise<Tables[StoreName] | undefined> {
    const { index } = this.index(storeName, indexName);
    return this.getFromStoreOrIndex(index, key);
  }

  /**
   * Get all values from an index that match a key value or a key range.
   */
  async getIndexAll<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
    key: Key | IDBKeyRange,
  ): Promise<Array<Tables[StoreName]>> {
    const { index } = this.index(storeName, indexName);
    const request = index.getAll(key);

    return new Promise<Array<Tables[StoreName]>>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve(request.result ?? ([] as Array<Tables[StoreName]>));
    });
  }

  /**
   * Returns a Cursor which will iterate over the store, or over the key range.
   */
  iterate<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    keyRange?: IDBKeyRange,
    direction?: IDBCursorDirection,
  ): AsyncIterable<CursorIteratorValue<Tables[StoreName]>> {
    const store = this.store(storeName);
    const request = store.openCursor(keyRange, direction);

    return new Cursor<Tables, StoreName>(storeName, this.onChange, request);
  }

  /**
   * Returns a Cursor which will iterate over the index for a key or a key range.
   */
  iterateIndex<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
    key: Key | IDBKeyRange,
    direction?: IDBCursorDirection,
  ): AsyncIterable<CursorIteratorValue<Tables[StoreName]>> {
    const { index } = this.index(storeName, indexName);
    const request = index.openCursor(key, direction);

    return new Cursor<Tables, StoreName>(storeName, this.onChange, request);
  }

  /**
   * Get the count of objects in an object store, or the count that matches a key range.
   */
  async getCount<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    keyRange?: IDBKeyRange,
  ): Promise<number> {
    const store = this.store(storeName);
    const request = store.count(keyRange);

    return new Promise<number>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get the count of objects in an index that match a key value or range.
   */
  async getIndexCount<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexName: ValidKeyPaths<Tables[StoreName]>,
    key: Key | IDBKeyRange,
  ): Promise<number> {
    const { index } = this.index(storeName, indexName);
    const request = index.count(key);

    return new Promise<number>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Gets an object by key from an object store, or the first item in a key range.
   */
  private async getFromStoreOrIndex<ObjectType, KeyType extends Key>(
    storeOrIndex: IDBObjectStore | IDBIndex,
    key: KeyType | IDBKeyRange,
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
  async put<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    obj: Tables[StoreName],
    key?: Key,
  ): Promise<void> {
    const store = this.store(storeName);

    const request = store.put(obj, key);

    request.onerror = () => this.deferred.reject(request.error);
    request.onsuccess = () => {
      this.onChange({
        type: 'created',
        storeName,
        obj,
      });
    };
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
    const store = this.store(storeName);

    const obj = await this.getFromStoreOrIndex<Tables[StoreName], typeof key>(
      store,
      key,
    );

    if (obj === undefined) {
      return undefined;
    }

    const updated = { ...obj, ...updates } as Tables[StoreName];

    const request = store.put(updated);

    request.onerror = () => this.deferred.reject(request.error);
    request.onsuccess = () => {
      this.onChange({
        type: 'updated',
        storeName,
        obj: updated,
      });
    };

    return updated;
  }

  /**
   * Insert or update an object in an object store.
   *
   * If the object exists and `updateMap` is provided, the return value from `updateMap` will be
   * used to update the record. This allows you to update specific keys of the record if it exists,
   * but create an entire record if it does not.
   *
   * This method checks for the existence of the object before inserting, and will dispatch an
   * event based on what it finds, either 'created' if not object was found or 'updated' if an
   * object was found.
   */
  async upsert<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    key: Key,
    obj: Tables[StoreName],
    updateMap?: (record: Tables[StoreName]) => Partial<Tables[StoreName]>,
  ): Promise<Tables[StoreName]> {
    const store = this.store(storeName);
    const existing = await this.getFromStoreOrIndex<
      Tables[StoreName],
      typeof key
    >(store, key);

    let request: IDBRequest;
    let result: Tables[StoreName];

    if (existing && updateMap) {
      result = { ...existing, ...updateMap(existing) };
      request = store.put(result);
    } else {
      result = obj;
      request = store.put(obj);
    }

    request.onerror = () => this.deferred.reject(request.error);
    request.onsuccess = () => {
      this.onChange({
        type: existing ? 'updated' : 'created',
        storeName,
        obj: result,
      });
    };

    return result;
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
    const store = this.store(storeName);

    const request = store.delete(key);

    request.onerror = () => this.deferred.reject(request.error);
    request.onsuccess = () => {
      this.onChange({
        type: 'deleted',
        storeName,
        key,
      });
    };
  }

  /**
   * Clear an object store.
   *
   * Dispatches the 'cleared' event.
   */
  async clear<StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
  ): Promise<void> {
    const store = this.store(storeName);

    const request = store.clear();

    request.onerror = () => this.deferred.reject(request.error);
    request.onsuccess = () => {
      this.onChange({
        type: 'cleared',
        storeName,
      });
    };
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

  private onChange = (change: TransactionChange) => {
    this._changes.push(change);
  };
}
