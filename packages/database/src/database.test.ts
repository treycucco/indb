import { SCHEMA, USERS_INDEX, USERS_LIST } from '../test/fixtures.js';
import type { Tables, User } from '../test/fixtures.js';
import type { StoreChanges } from './change.js';
import Database, { deleteDatabase } from './database.js';
import type { Key } from './keyPath.js';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe(Database, () => {
  let dbName: string;
  let db: Database<Tables>;
  let changeHandler: Mock;
  let deregisterHandler: () => void;

  beforeEach(async () => {
    dbName = crypto.randomUUID();
    db = new Database<Tables>(dbName, SCHEMA);
    await db.putMany('users', USERS_LIST);

    changeHandler = vi.fn();
    deregisterHandler = db.addEventListener('changed', changeHandler);
  });

  afterEach(async () => {
    changeHandler.mockClear();
    deregisterHandler();
    await deleteDatabase(dbName);
  });

  const assertChangeHandlerCall = async (
    change: StoreChanges,
    callIndex = 0,
  ) => {
    expect(changeHandler).toHaveBeenCalledTimes(1);
    expect(changeHandler.mock.calls[callIndex][0].detail).toEqual(change);
  };

  describe('get', () => {
    test('gets the object for valid ids', async () => {
      const user = await db.get('users', 1);

      expect(user).toEqual(USERS_INDEX[1]);
    });

    test('returns undefined for invalid ids', async () => {
      const user = await db.get('users', 100);

      expect(user).toBeUndefined();
    });
  });

  describe('getAll', () => {
    test('gets all objects in the store', async () => {
      const users = await db.getAll('users');

      expect(Object.fromEntries(users.map((user) => [user.id, user]))).toEqual(
        USERS_INDEX,
      );
    });
  });

  describe('getIndex', () => {
    test('gets first object matching the key in the index', async () => {
      const user = await db.getIndex('users', 'favorite.color', 'green');
      expect(user).toEqual(USERS_INDEX[2]);
    });

    test('returns undefined when there are no matches', async () => {
      const user = await db.getIndex('users', 'favorite.color', 'purple');
      expect(user).toBeUndefined();
    });
  });

  describe('getIndexAll', () => {
    test('gets all objects matching index value', async () => {
      const users = await db.getIndexAll('users', 'favorite.color', 'blue');

      expect(Object.fromEntries(users.map((user) => [user.id, user]))).toEqual(
        Object.fromEntries(
          USERS_LIST.filter((user) => user.favorite?.color === 'blue').map(
            (user) => [user.id, user],
          ),
        ),
      );
    });

    test('returns an empty array when there are no matches', async () => {
      const users = await db.getIndexAll('users', 'favorite.color', 'purple');

      expect(users).toEqual([]);
    });
  });

  describe('iterate', () => {
    test('iterates all items in the table', async () => {
      const users: User[] = [];
      const { iterator } = await db.iterate('users');

      for await (const value of iterator) {
        users.push(value.obj);
      }

      expect(Object.fromEntries(users.map((user) => [user.id, user]))).toEqual(
        USERS_INDEX,
      );
    });

    test('raises events for updated people', async () => {
      const { iterator, promise } = await db.iterate('users');
      const updates: User[] = [];

      for await (const value of iterator) {
        if (value.obj.firstName === 'A') {
          updates.push(value.update({ firstName: 'Z' }));
        }
      }

      await promise;

      expect(updates).toHaveLength(5);
      assertChangeHandlerCall({
        storeName: 'users',
        changes: updates.map((update) => ({ type: 'updated', obj: update })),
      });
    });

    test('raises events for deleted people', async () => {
      const { iterator, promise } = await db.iterate('users');
      const deleted: Key[] = [];

      for await (const value of iterator) {
        if (value.obj.firstName === 'A') {
          value.delete();
          deleted.push(value.key);
        }
      }

      await promise;

      expect(deleted).toHaveLength(5);
      assertChangeHandlerCall({
        storeName: 'users',
        changes: deleted.map((key) => ({ type: 'deleted', key })),
      });
    });
  });

  describe('iterateIndex', () => {
    test('iterates all items in an index key', async () => {
      const users: User[] = [];
      const { iterator } = await db.iterateIndex(
        'users',
        'favorite.color',
        'blue',
      );

      for await (const value of iterator) {
        users.push(value.obj);
      }

      expect(Object.fromEntries(users.map((user) => [user.id, user]))).toEqual(
        Object.fromEntries(
          USERS_LIST.filter((user) => user.favorite?.color === 'blue').map(
            (user) => [user.id, user],
          ),
        ),
      );
    });
  });

  describe('getCount', () => {
    test('gets the count of objects in the store', async () => {
      const count = await db.getCount('users');
      expect(count).toBe(9);
    });
  });

  describe('getIndexCount', () => {
    test('gets the count of objects in the store', async () => {
      const count = await db.getIndexCount('users', 'favorite.color', 'blue');
      expect(count).toBe(3);
    });
  });

  describe('put', () => {
    test("adds a new object when the key doesn't exist", async () => {
      const newUser = { id: 100, firstName: 'Z', lastName: 'Z' };
      await db.put('users', newUser);

      expect(await db.get('users', 100)).toEqual(newUser);

      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [{ type: 'created', obj: newUser }],
      });
    });

    test('updates existing object when the key exists', async () => {
      const updatedUser = { id: 1, firstName: 'Z', lastName: 'Z' };
      await db.put('users', updatedUser);

      expect(await db.get('users', 1)).toEqual(updatedUser);

      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [{ type: 'created', obj: updatedUser }],
      });
    });
  });

  describe('putMany', () => {
    test('adds and updates objects', async () => {
      const updatedUser = { id: 1, firstName: 'Y', lastName: 'Y' };
      const newUser = { id: 100, firstName: 'Z', lastName: 'Z' };

      await db.putMany('users', [updatedUser, newUser]);

      expect(await db.get('users', 1)).toEqual(updatedUser);
      expect(await db.get('users', 100)).toEqual(newUser);

      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [
          { type: 'created', obj: updatedUser },
          { type: 'created', obj: newUser },
        ],
      });
    });
  });

  describe('update', () => {
    test('updates the object if it exists', async () => {
      const updates = { firstName: 'Z' };

      const updatedUser = await db.update('users', 1, updates);

      expect(updatedUser).not.toBeUndefined();
      expect(await db.get('users', 1)).toEqual({
        ...USERS_INDEX[1],
        ...updates,
      });

      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [{ type: 'updated', obj: updatedUser }],
      });
    });

    test('returns undefined if the object does not exist', async () => {
      const updates = { firstName: 'Z' };

      const response = await db.update('users', 100, updates);

      expect(response).toBeUndefined();
      expect(changeHandler).toHaveBeenCalledTimes(0);
    });
  });

  describe('upsert', () => {
    test("adds a new object when the key doesn't exist and dispatches created event", async () => {
      const newUser = { id: 100, firstName: 'Z', lastName: 'Z' };
      await db.upsert('users', 100, newUser);

      expect(await db.get('users', 100)).toEqual(newUser);

      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [{ type: 'created', obj: newUser }],
      });
    });

    test('updates existing object when the key exists and dispatches updated event', async () => {
      const updatedUser = { id: 1, firstName: 'Z', lastName: 'Z' };
      await db.upsert('users', 1, updatedUser);

      expect(await db.get('users', 1)).toEqual(updatedUser);

      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [{ type: 'updated', obj: updatedUser }],
      });
    });
  });

  describe('delete', () => {
    test('deletes item when key exists and dispatches deleted event', async () => {
      await db.delete('users', 1);

      expect(await db.get('users', 1)).toBeUndefined();

      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [{ type: 'deleted', key: 1 }],
      });
    });

    test('does nothing when key exists and dispatches deleted event', async () => {
      await db.delete('users', 100);

      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [{ type: 'deleted', key: 100 }],
      });
    });
  });

  describe('transaction', () => {
    test('fires off all events correctly', async () => {
      const tx = await db.transaction(['users'], 'readwrite');

      const initialUser: User = { id: 100, firstName: 'Z', lastName: 'T' };

      tx.put('users', initialUser);

      const updatedUser = await tx.update('users', 100, { firstName: 'ZZ' });

      tx.delete('users', 100);

      await tx.promise;
      await assertChangeHandlerCall({
        storeName: 'users',
        changes: [
          { type: 'created', obj: initialUser },
          { type: 'updated', obj: updatedUser },
          { type: 'deleted', key: 100 },
        ],
      });
    });
  });

  describe('getKeyExtractor', () => {
    test('returns function that gets keyPath value', async () => {
      const user = await db.get('users', 1);
      const extractor = db.getKeyExtractor('users');

      expect(extractor(user!)).toBe(1);
    });
  });
});
