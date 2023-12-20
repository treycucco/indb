import type { Filter, KVEntry, Tables } from '../test/fixtures.js';
import { SCHEMA } from '../test/fixtures.js';
import KVStore from './kvstore.js';
import { Database, deleteDatabase } from '@indb/database';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe(KVStore, () => {
  let dbName: string;
  let db: Database<Tables>;
  let kvStore: KVStore<Tables, KVEntry>;

  beforeEach(async () => {
    dbName = crypto.randomUUID();
    db = new Database<Tables>(dbName, SCHEMA);
    kvStore = new KVStore<Tables, KVEntry>(db);
  });

  afterEach(async () => {
    await deleteDatabase(dbName);
  });

  test('get/set/has/delete', async () => {
    // Value does not exist at first
    expect(await kvStore.has('me')).toBe(false);
    expect(await kvStore.get('me')).toBeUndefined();

    // Add it
    const user = { id: 1, firstName: 'AA', lastName: 'BB' };
    await kvStore.set('me', user);

    // Value exists
    expect(await kvStore.has('me')).toBe(true);
    expect(await kvStore.get('me')).toEqual(user);

    // Delete it
    await kvStore.delete('me');

    // Value no longer exists
    expect(await kvStore.has('me')).toBe(false);
    expect(await kvStore.get('me')).toBeUndefined();
  });

  test('works with array types', async () => {
    const filters: Filter[] = [
      { field: 'name', value: 'bob', operator: '=' },
      { field: 'age', value: 30, operator: '>' },
    ];

    await kvStore.set('filters', filters);

    expect(await kvStore.has('filters')).toBe(true);
    expect(await kvStore.get('filters')).toEqual(filters);
  });
});
