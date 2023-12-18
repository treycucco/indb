import { SCHEMA, USERS_INDEX, USERS_LIST } from '../test/fixtures.js';
import type { Tables } from '../test/fixtures.js';
import { waitFor } from '../test/utils.js';
import Counter from './counter.js';
import { Database, deleteDatabase } from '@indb/database';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe(Counter, () => {
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
    let counter: Counter<Tables, 'users'>;

    afterEach(() => {
      counter.teardown();
    });

    describe('no filter', () => {
      beforeEach(async () => {
        counter = new Counter<Tables, 'users'>({
          database: db,
          storeName: 'users',
        });
        await counter.setup();
      });

      test('db.put adds to the count', async () => {
        expect(counter.getSnapshot()).toBe(9);

        const newUser = { id: 11, firstName: 'Z', lastName: 'Z' };
        await db.put('users', newUser);

        await waitFor(() => expect(counter.getSnapshot()).toBe(10));
      });

      test('db.putMany updates in and adds to the count', async () => {
        const updated1 = { id: 1, firstName: 'F', lastName: 'L' };
        const new100 = { id: 100, firstName: 'Z', lastName: 'Z' };
        await db.putMany('users', [updated1, new100]);

        await waitFor(() => expect(counter.getSnapshot()).toBe(10));
      });

      test('db.delete deletes from the count', async () => {
        await db.delete('users', 1);

        await waitFor(() => expect(counter.getSnapshot()).toBe(8));
      });
    });

    describe('filter', () => {
      beforeEach(async () => {
        counter = new Counter<Tables, 'users'>({
          database: db,
          storeName: 'users',
          filter: (user) => user.firstName === 'B',
        });
        await counter.setup();
      });

      test('filter filters users', async () => {
        await waitFor(() => expect(counter.getSnapshot()).toBe(4));
      });

      test('users added to filter are added', async () => {
        await waitFor(() => expect(counter.getSnapshot()).toBe(4));

        const newUser1 = { id: 11, firstName: 'A', lastName: 'Z' };
        const newUser2 = { id: 12, firstName: 'B', lastName: 'Z' };

        await db.put('users', newUser1);
        await db.put('users', newUser2);

        await waitFor(() => expect(counter.getSnapshot()).toBe(5));
      });

      test('users removed from filter are removed', async () => {
        await waitFor(() => expect(counter.getSnapshot()).toBe(4));

        await db.delete('users', 2);

        await waitFor(() => expect(counter.getSnapshot()).toBe(3));
      });
    });
  });

  describe('index', () => {
    let counter: Counter<Tables, 'users'>;

    afterEach(() => {
      counter.teardown();
    });

    describe('no filter', () => {
      beforeEach(async () => {
        counter = new Counter<Tables, 'users'>({
          database: db,
          storeName: 'users',
          index: {
            path: 'lastName',
            value: 'A',
          },
        });
        await counter.setup();
      });

      test('db.put adds to count if value matches index', async () => {
        expect(counter.getSnapshot()).toBe(2);

        const newUser = { id: 11, firstName: 'Z', lastName: 'A' };
        await db.put('users', newUser);

        await waitFor(() => expect(counter.getSnapshot()).toBe(3));
      });

      test('db.put removes from count if value does not matche index', async () => {
        expect(counter.getSnapshot()).toBe(2);

        const updatedUser = { id: 1, firstName: 'Z', lastName: 'Z' };
        await db.put('users', updatedUser);

        await waitFor(() => expect(counter.getSnapshot()).toBe(1));
      });

      test('db.putMany adds matching items to index', async () => {
        const update3 = { ...USERS_INDEX[3]!, firstName: 'C', lastName: 'A' };
        const new100 = { id: 100, firstName: 'D', lastName: 'A' };
        await db.putMany('users', [update3, new100]);

        await waitFor(() => expect(counter.getSnapshot()).toEqual(4));
      });

      test('db.remove removes from the index', async () => {
        expect(counter.getSnapshot()).toBe(2);

        await db.delete('users', 1);

        await waitFor(() => expect(counter.getSnapshot()).toBe(1));
      });
    });

    describe('with filter', () => {
      beforeEach(async () => {
        counter = new Counter<Tables, 'users'>({
          database: db,
          storeName: 'users',
          index: {
            path: 'lastName',
            value: 'A',
          },
          filter: (user) => /^B/.test(user.firstName),
        });
        await counter.setup();
      });

      test('filter filters users', async () => {
        await waitFor(() => expect(counter.getSnapshot()).toBe(1));
      });

      test('users added to filter are added', async () => {
        await waitFor(() => expect(counter.getSnapshot()).toBe(1));

        const newUser1 = { id: 12, firstName: 'Ba', lastName: 'A' };
        const newUser2 = { id: 13, firstName: 'Bb', lastName: 'A' };
        // User 3 is not in index, but does pass filter. Should not be included
        const newUser3 = { id: 11, firstName: 'Ba', lastName: 'B' };

        await db.put('users', newUser1);
        await db.put('users', newUser2);
        await db.put('users', newUser3);

        await waitFor(() => expect(counter.getSnapshot()).toBe(3));
      });

      test('users removed from filter are removed', async () => {
        await waitFor(() => expect(counter.getSnapshot()).toBe(1));

        await db.delete('users', 2);

        await waitFor(() => expect(counter.getSnapshot()).toBe(0));
      });
    });
  });
});
