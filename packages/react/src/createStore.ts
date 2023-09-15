import useLifecycleMemo from './useLifecycleMemo';
import { Database } from '@indb/database';
import type {
  Key,
  SchemaDefinition,
  StoreNames,
  ValidKeyPaths,
} from '@indb/database';
import { Counter, Slice } from '@indb/stores';
import type { Comparer, IndexFilter } from '@indb/stores';
import { createContext, useCallback, useContext } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

/**
 * Initialize a database, and return methods for working with it via hooks:
 *
 * - DatabaseProvider: a context provider whose value is the database
 * - useDatabaseContext: a hook to fetch the database from context
 * - useSlice: a hook that will create a Slice and provide its data and methods for working with
 *             the data.
 * - useCount: a hook that will create a Counter and provide its count
 *
 * For most cases you should be able to work directly with the hooks without working with context.
 */
const createStore = <Tables extends object>(
  databaseName: string,
  schema: SchemaDefinition<Tables>,
) => {
  const database = new Database<Tables>(databaseName, schema);
  const DatabaseContext = createContext<Database<Tables>>(database);

  const useDatabaseContext = () => useContext(DatabaseContext);

  const useSlice = <StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    compare: Tables[StoreName] extends object
      ? Comparer<Tables[StoreName]>
      : never,
    indexPath?: ValidKeyPaths<Tables[StoreName]>,
    indexValue?: string,
  ) => {
    const slice = useLifecycleMemo(() => {
      const slice = new Slice({
        database,
        storeName,
        compare,
        index: buildIndexFilter(indexPath, indexValue),
      });
      slice.setup();
      return [slice, () => slice.teardown()];
    }, [storeName, compare, indexPath, indexValue]);

    const data = useSyncExternalStore(slice.subscribe, slice.getSnapshot);

    const addMany = useCallback(
      (objs: Array<Tables[StoreName]>) => {
        return database.putMany(storeName, objs);
      },
      [storeName],
    );

    const add = useCallback(
      (obj: Tables[StoreName]) => {
        // We do not need to update the collection here. After the database makes its update it will
        // dispatch an event which we subscribe to to make collection changes.
        return database.put(storeName, obj);
      },
      [storeName],
    );

    /**
     * Update an object in the underlying database.
     */
    const update = useCallback(
      (key: Key, updates: Partial<Tables[StoreName]>) => {
        // We do not need to update the collection here. After the database makes its update it will
        // dispatch an event which we subscribe to to make collection changes.
        return database.update(storeName, key, updates);
      },
      [storeName],
    );

    /**
     * Delete an object in the underlying database.
     */
    const remove = useCallback(
      (key: Key) => {
        // We do not need to update the collection here. After the database makes its update it will
        // dispatch an event which we subscribe to to make collection changes.
        return database.delete(storeName, key);
      },
      [storeName],
    );

    return {
      data,
      addMany,
      add,
      update,
      remove,
    };
  };

  const useCount = <StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    indexPath?: ValidKeyPaths<Tables[StoreName]>,
    indexValue?: string,
  ) => {
    const counter = useLifecycleMemo(() => {
      const counter = new Counter({
        database,
        storeName,
        index: buildIndexFilter(indexPath, indexValue),
      });
      counter.setup();
      return [counter, () => counter.teardown()];
    }, [storeName, indexPath, indexValue]);

    const count = useSyncExternalStore(counter.subscribe, counter.getSnapshot);

    return count;
  };

  return {
    database,
    DatabaseProvider: DatabaseContext.Provider,
    useDatabaseContext,
    useSlice,
    useCount,
  };
};

const buildIndexFilter = <
  Tables extends object,
  StoreName extends StoreNames<Tables>,
>(
  path?: ValidKeyPaths<Tables[StoreName]>,
  value?: string,
): IndexFilter<Tables, StoreName> | undefined => {
  if (path && value) {
    return { path, value };
  }
  return undefined;
};

export default createStore;
