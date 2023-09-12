import type { Key, ValidKeyPaths } from './keyPath';

export type StoreNames<Tables> = Tables extends object
  ? Exclude<keyof Tables, symbol | number>
  : never;

// TODO: Move to stores package
export type IndexFilter<
  Tables extends object,
  StoreName extends StoreNames<Tables>,
> = {
  path: ValidKeyPaths<Tables[StoreName]>;
  value: Key;
};

export type StoreDefinition<ObjectType> = ObjectType extends object
  ? {
      keyPath: ValidKeyPaths<ObjectType>;
      autoIncrement?: boolean;
      indices?: {
        [IndexKeyPaths in ValidKeyPaths<ObjectType>]?: {
          unique?: boolean;
        };
      };
    }
  : never;

export type StoreDefinitions<Tables> = Tables extends object
  ? {
      [StoreName in StoreNames<Tables>]: StoreDefinition<Tables[StoreName]>;
    }
  : never;

export type SchemaDefinition<Tables> = {
  stores: StoreDefinitions<Tables>;
  version: number;
  customMigration?: (
    transaction: IDBTransaction,
    schema: SchemaDefinition<Tables>,
    oldVersion: number,
  ) => void;
};

/**
 * Migrate a database to a new schema.
 *
 * This method takes a schema definition, inspects the current schema, and makes the changes
 * necessary changes to make the schema match the definition.
 *
 * This method assumes the caller has set onerror and oncomplete handlers on the transaction.
 */
export const migrateSchema = <Tables>(
  transaction: IDBTransaction,
  schema: SchemaDefinition<Tables>,
  oldVersion: number,
) => {
  for (const storeName of Object.keys(schema.stores)) {
    const storeDefinition =
      schema.stores[storeName as keyof typeof schema.stores]!;
    if (!transaction.db.objectStoreNames.contains(storeName)) {
      const { keyPath, autoIncrement = false } = storeDefinition;
      // console.debug(`Creating object store ${storeName}`);
      transaction.db.createObjectStore(storeName, { keyPath, autoIncrement });
    }

    const store = transaction.objectStore(storeName)!;
    const { indices = {} } = storeDefinition;

    for (const indexKeyPath of Object.keys(indices)) {
      if (!store.indexNames.contains(indexKeyPath)) {
        const { unique = false } =
          indices[indexKeyPath as keyof typeof indices];
        // console.debug(`Creating index ${storeName}:${indexKeyPath}`);
        store.createIndex(indexKeyPath, indexKeyPath, {
          unique,
          multiEntry: false,
        });
      }
    }

    for (const indexName of store.indexNames) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(indexName in indices)) {
        // console.debug(`Deleting index ${storeName}:${indexName}`);
        store.deleteIndex(indexName);
      }
    }
  }

  for (const storeName of transaction.db.objectStoreNames) {
    if (!(storeName in schema.stores)) {
      // console.debug(`Deleting store ${storeName}`);
      transaction.db.deleteObjectStore(storeName);
    }
  }

  schema.customMigration?.(transaction, schema, oldVersion);
};
