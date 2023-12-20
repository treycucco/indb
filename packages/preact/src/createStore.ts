import useLifecycleMemo from './useLifecycleMemo.js';
import { Database } from '@indb/database';
import type {
  Key,
  SchemaDefinition,
  StoreNames,
  ValidKeyPaths,
} from '@indb/database';
import { Counter, Entity, Slice } from '@indb/stores';
import type { Comparer, IndexFilter, Predicate } from '@indb/stores';
import { createContext } from 'preact';
import { useSyncExternalStore } from 'preact/compat';
import { useContext } from 'preact/hooks';

/**
 * Initialize a database, and return methods for working with it via hooks:
 *
 * - DatabaseProvider: a context provider whose value is the database
 * - useDatabaseContext: a hook to fetch the database from context
 * - useSlice: a hook that will create a Slice and provide its data and methods for working with
 *             the data.
 * - useCount: a hook that will create a Counter and provide its count
 * - useEntity: a hook that will load up an entity by key.
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
    compare: Comparer<Tables[StoreName]>,
    index?: IndexFilter<Tables, StoreName>,
    filter?: Predicate<Tables[StoreName]>,
  ) => {
    const indexPath = index?.path;
    const indexValue = index?.value;

    const slice = useLifecycleMemo(() => {
      const slice = new Slice({
        database,
        storeName,
        compare,
        index: buildIndexFilter(indexPath, indexValue),
        filter,
      });
      slice.setup();
      return [slice, () => slice.teardown()];
    }, [storeName, compare, indexPath, indexValue, filter]);

    const data = useSyncExternalStore(slice.subscribe, slice.getSnapshot);

    return data;
  };

  const useCount = <StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    index?: IndexFilter<Tables, StoreName>,
    filter?: Predicate<Tables[StoreName]>,
  ) => {
    const indexPath = index?.path;
    const indexValue = index?.value;

    const counter = useLifecycleMemo(() => {
      const counter = new Counter({
        database,
        storeName,
        index: buildIndexFilter(indexPath, indexValue),
        filter,
      });
      counter.setup();
      return [counter, () => counter.teardown()];
    }, [storeName, indexPath, indexValue, filter]);

    const count = useSyncExternalStore(counter.subscribe, counter.getSnapshot);

    return count;
  };

  const useEntity = <StoreName extends StoreNames<Tables>>(
    storeName: StoreName,
    key: Key,
  ) => {
    const entity = useLifecycleMemo(() => {
      const entity = new Entity({
        database,
        storeName,
        key,
      });
      entity.setup();
      return [entity, () => entity.teardown()];
    }, [storeName, key]);

    const value = useSyncExternalStore(entity.subscribe, entity.getSnapshot);

    return value;
  };

  return {
    database,
    DatabaseProvider: DatabaseContext.Provider,
    useDatabaseContext,
    useSlice,
    useCount,
    useEntity,
  };
};

const buildIndexFilter = <
  Tables extends object,
  StoreName extends StoreNames<Tables>,
>(
  path?: ValidKeyPaths<Tables[StoreName]>,
  value?: Key,
): IndexFilter<Tables, StoreName> | undefined => {
  if (path && value) {
    return { path, value };
  }
  return undefined;
};

export default createStore;
