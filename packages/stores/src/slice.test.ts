import type { Tables } from '..//test/fixtures';
import {
  SCHEMA,
  USERS_INDEX,
  USERS_LIST,
  compareUsers,
} from '../test/fixtures';
import { waitFor } from '../test/utils';
import Slice from './slice';
import { Database, deleteDatabase } from '@indb/database';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe(Slice, () => {
  let dbName: string;
  let db: Database<Tables>;

  beforeEach(async () => {
    dbName = crypto.randomUUID();
    db = new Database<Tables>(dbName, SCHEMA);
    await db.putMany('users', USERS_LIST);
  });

  afterEach(async () => {
    await deleteDatabase(dbName);
  });

  describe('store', () => {
    let slice: Slice<Tables, 'users'>;

    beforeEach(async () => {
      slice = new Slice<Tables, 'users'>({
        database: db,
        storeName: 'users',
        compare: compareUsers,
      });
      await slice.setup();
    });

    afterEach(() => {
      slice.teardown();
    });

    test('db.put adds to the collection', async () => {
      expect(slice.getSnapshot().index[11]).toBeUndefined();

      const newUser = { id: 11, firstName: 'Z', lastName: 'Z' };
      await db.put('users', newUser);

      await waitFor(() =>
        expect(slice.getSnapshot().index[11]).toEqual(newUser),
      );
    });

    test('db.putMany updates in and adds to the collection', async () => {
      const updated1 = { id: 1, firstName: 'F', lastName: 'L' };
      const new100 = { id: 100, firstName: 'Z', lastName: 'Z' };
      await db.putMany('users', [updated1, new100]);

      await waitFor(() => {
        const { index } = slice.getSnapshot();
        expect(index[1]).toEqual(updated1);
        expect(index[100]).toEqual(new100);
      });
    });

    test('db.update updates in the collection', async () => {
      await db.update('users', 1, { firstName: 'Z' });

      await waitFor(() =>
        expect(slice.getSnapshot().index[1]).toEqual({
          ...USERS_INDEX[1],
          firstName: 'Z',
        }),
      );
    });

    test('db.delete deletes from the collectiocollection', async () => {
      await db.delete('users', 1);

      await waitFor(() => expect(slice.getSnapshot().index[1]).toBeUndefined());
    });
  });

  describe('index', () => {
    let slice: Slice<Tables, 'users'>;

    beforeEach(async () => {
      slice = new Slice<Tables, 'users'>({
        database: db,
        storeName: 'users',
        compare: compareUsers,
        index: {
          path: 'lastName',
          value: 'A',
        },
      });
      await slice.setup();
    });

    afterEach(() => {
      slice.teardown();
    });

    test('db.put adds to collection if value matches index', async () => {
      expect(slice.getSnapshot().index[11]).toBeUndefined();

      const newUser = { id: 11, firstName: 'Z', lastName: 'A' };
      await db.put('users', newUser);

      await waitFor(() =>
        expect(slice.getSnapshot().index[11]).toEqual(newUser),
      );
    });

    test('db.put removes from collection if value does not matche index', async () => {
      expect(slice.getSnapshot().index[1]).not.toBeUndefined();

      const updatedUser = { id: 1, firstName: 'Z', lastName: 'Z' };
      await db.put('users', updatedUser);

      await waitFor(() => expect(slice.getSnapshot().index[1]).toBeUndefined());
    });

    test('db.putMany adds matching items to index', async () => {
      const update3 = { ...USERS_INDEX[3]!, firstName: 'C', lastName: 'A' };
      const new100 = { id: 100, firstName: 'D', lastName: 'A' };
      await db.putMany('users', [update3, new100]);

      await waitFor(() =>
        expect(slice.getSnapshot().ids).toEqual([1, 2, 3, 100]),
      );
    });

    test('db.remove removes from the index', async () => {
      expect(slice.getSnapshot().index[1]).not.toBeUndefined();

      await db.delete('users', 1);

      await waitFor(() => {
        expect(slice.getSnapshot().index[1]).toBeUndefined();
      });
    });
  });
});
