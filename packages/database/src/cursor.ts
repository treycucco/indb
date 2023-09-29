import type { TransactionChange } from './change';
import Deferred from './deferred';
import type { Key } from './keyPath';
import type { StoreNames } from './schema';

export type CursorIteratorValue<T> = {
  obj: T;
  key: Key;
  update: (updates: Partial<T>) => T;
  delete: () => void;
};

type ChangeHandler = (change: TransactionChange) => void;

export default class Cursor<Tables, StoreName extends StoreNames<Tables>>
  implements AsyncIterable<CursorIteratorValue<Tables[StoreName]>>
{
  private readonly storeName: StoreName;
  private readonly onChange: ChangeHandler;
  private isFirst = true;
  private deferred: Deferred<
    IteratorResult<CursorIteratorValue<Tables[StoreName]>>
  >;
  private cursor: IDBCursorWithValue | null = null;

  constructor(
    storeName: StoreName,
    onChange: ChangeHandler,
    request: IDBRequest<IDBCursorWithValue | null>,
  ) {
    this.storeName = storeName;
    this.onChange = onChange;
    this.deferred = new Deferred<
      IteratorResult<CursorIteratorValue<Tables[StoreName]>>
    >();

    request.onsuccess = () => {
      this.cursor = request.result;

      if (this.cursor) {
        this.deferred.resolve({
          done: false,
          value: {
            obj: this.cursor.value as Tables[StoreName],
            key: this.cursor.key as Key,
            update: this.update,
            delete: this.delete,
          },
        });
      } else {
        this.deferred.resolve({ done: true, value: undefined });
      }
    };
  }

  /**
   * Update the value under the cursor with the partial updates, and let the owning Transaction
   * know of the change.
   */
  private update = (updates: Partial<Tables[StoreName]>): Tables[StoreName] => {
    if (!this.cursor) {
      throw new Error('No cursor');
    }

    const value = this.cursor.value as Tables[StoreName];
    const updated = { ...value, ...updates };

    this.cursor.update(updated);

    this.onChange({ type: 'updated', storeName: this.storeName, obj: updated });

    return updated;
  };

  /**
   * Delete the value under the cursor, and let the owning Transaction know of the change.
   */
  private delete = () => {
    if (!this.cursor) {
      throw new Error('No cursor');
    }

    this.cursor.delete();

    this.onChange({
      type: 'deleted',
      storeName: this.storeName,
      key: this.cursor.key as Key,
    });
  };

  async next(): Promise<
    IteratorResult<CursorIteratorValue<Tables[StoreName]>>
  > {
    if (this.isFirst) {
      this.isFirst = false;
      return this.deferred.promise;
    }
    this.deferred = new Deferred<
      IteratorResult<CursorIteratorValue<Tables[StoreName]>>
    >();

    if (!this.cursor) {
      this.deferred.resolve({ done: true, value: undefined });
    } else {
      this.cursor.continue();
    }

    return this.deferred.promise;
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}
