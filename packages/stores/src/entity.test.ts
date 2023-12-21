import type { Tables } from '../test/fixtures.js';
import { SCHEMA, USERS_INDEX, USERS_LIST } from '../test/fixtures.js';
import { waitFor } from '../test/utils.js';
import Entity from './entity.js';
import { Database, deleteDatabase } from '@indb/database';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe(Entity, () => {
  let dbName: string;
  let db: Database<Tables>;
  let entity: Entity<Tables, 'users'>;

  beforeEach(async () => {
    dbName = crypto.randomUUID();
    db = new Database<Tables>(dbName, SCHEMA);
    await db.putMany('users', USERS_LIST);
  });

  afterEach(async () => {
    await deleteDatabase(dbName);
    entity.teardown();
  });

  test('snapshot updates correctly with events', async () => {
    const key = 100;

    entity = new Entity<Tables, 'users'>({
      database: db,
      storeName: 'users',
      key,
    });

    entity.setup();

    // Status starts out in LOADING
    expect(entity.getSnapshot()).toEqual({
      status: 'LOADING',
      entity: undefined,
    });

    // This entity doesn't exist yet, so we'll get NOT_FOUND
    await waitFor(() =>
      expect(entity.getSnapshot()).toEqual({
        status: 'NOT_FOUND',
        entity: undefined,
      }),
    );

    // After adding the entity the store should update to the value.
    const newUser = { id: key, firstName: 'Z', lastName: 'Z' };
    await db.put('users', newUser);

    await waitFor(() =>
      expect(entity.getSnapshot()).toEqual({
        status: 'FOUND',
        entity: newUser,
      }),
    );

    // Updating the record updates the entity
    await db.update('users', key, { firstName: 'ZZ', lastName: 'YZ' });

    await waitFor(() =>
      expect(entity.getSnapshot()).toEqual({
        status: 'FOUND',
        entity: { ...newUser, firstName: 'ZZ', lastName: 'YZ' },
      }),
    );

    // Deleting the user sets the entity to NOT_FOUND
    await db.delete('users', key);

    await waitFor(() =>
      expect(entity.getSnapshot()).toEqual({
        status: 'NOT_FOUND',
        entity: undefined,
      }),
    );
  });

  test('immeidately finds entity if present', async () => {
    const key = 1;

    entity = new Entity<Tables, 'users'>({
      database: db,
      storeName: 'users',
      key,
    });

    entity.setup();

    // Status starts out in LOADING
    expect(entity.getSnapshot()).toEqual({
      status: 'LOADING',
      entity: undefined,
    });

    // This entity doesn't exist yet, so we'll get NOT_FOUND
    await waitFor(() =>
      expect(entity.getSnapshot()).toEqual({
        status: 'FOUND',
        entity: USERS_INDEX[1],
      }),
    );
  });

  test('db.clear sets entity to NOT_FOUND', async () => {
    const key = 1;

    entity = new Entity<Tables, 'users'>({
      database: db,
      storeName: 'users',
      key,
    });

    entity.setup();

    // Status starts out in LOADING
    expect(entity.getSnapshot()).toEqual({
      status: 'LOADING',
      entity: undefined,
    });

    // This entity doesn't exist yet, so we'll get NOT_FOUND
    await waitFor(() =>
      expect(entity.getSnapshot()).toEqual({
        status: 'FOUND',
        entity: USERS_INDEX[1],
      }),
    );

    await db.clear('users');

    await waitFor(() =>
      expect(entity.getSnapshot()).toEqual({
        status: 'NOT_FOUND',
        entity: undefined,
      }),
    );
  });

  test("other entities changing doesn't change snapshot", async () => {
    const key = 1;

    entity = new Entity<Tables, 'users'>({
      database: db,
      storeName: 'users',
      key,
    });

    await entity.setup();

    const snapshot1 = entity.getSnapshot();

    await db.update('users', 2, { firstName: 'H', lastName: 'IJK' });

    const snapshot2 = entity.getSnapshot();

    // The snapshot should not have changed at all.
    expect(snapshot1).toBe(snapshot2);
  });
});
