import {
  USERS_INDEX,
  USERS_LIST,
  compareUsers,
  getUserKey,
} from '../../test/fixtures';
import Collection from './index';
import { describe, expect, test } from 'vitest';

describe(Collection, () => {
  const u1 = USERS_INDEX[1]!;
  const u2 = USERS_INDEX[2]!;

  describe('constructor', () => {
    test('puts objects in correct initial order', () => {
      const collection = new Collection(
        getUserKey,
        compareUsers,
        [...USERS_LIST].reverse(),
      );

      expect(collection.toData()).toEqual({
        ids: USERS_LIST.map((u) => u.id),
        index: USERS_INDEX,
      });
    });
  });

  describe('add', () => {
    test('empty collection adds to the end', () => {
      const collection = new Collection(getUserKey, compareUsers, []);

      collection.add(u1);

      expect(collection.toData()).toEqual({
        ids: [u1.id],
        index: { [u1.id]: u1 },
      });
    });

    test('single item collection with earlier sort adds to beginning', () => {
      const collection = new Collection(getUserKey, compareUsers, [u2]);

      collection.add(u1);

      expect(collection.toData()).toEqual({
        ids: [u1.id, u2.id],
        index: {
          [u1.id]: u1,
          [u2.id]: u2,
        },
      });
    });

    test('single item collection with later sort adds to end', () => {
      const collection = new Collection(getUserKey, compareUsers, [u1]);

      collection.add(u2);

      expect(collection.toData()).toEqual({
        ids: [1, 2],
        index: {
          [u1.id]: u1,
          [u2.id]: u2,
        },
      });
    });

    test.each(USERS_LIST)('inserting user $id', (user) => {
      const initialUsers = USERS_LIST.filter((u) => u !== user);
      const collection = new Collection(getUserKey, compareUsers, initialUsers);

      collection.add(user);

      expect(collection.toData()).toEqual({
        ids: USERS_LIST.map((u) => u.id),
        index: USERS_INDEX,
      });
    });

    test('update value sorting order', () => {
      const collection = new Collection(getUserKey, compareUsers, [u1, u2]);
      const updatedU1 = { ...u1, lastName: 'Z' };
      collection.add(updatedU1);

      expect(collection.toData()).toEqual({
        ids: [u2.id, u1.id],
        index: {
          [u1.id]: updatedU1,
          [u2.id]: u2,
        },
      });
    });
  });

  describe('remove', () => {
    test('item in collection', () => {
      const collection = new Collection(getUserKey, compareUsers, USERS_LIST);
      const removed = collection.remove(3);

      expect(removed).toBe(true);
      expect(collection.toData()).toEqual({
        ids: USERS_LIST.filter((u) => u.id !== 3).map((u) => u.id),
        index: Object.fromEntries(
          Object.entries(USERS_INDEX).filter(([id]) => id !== '3'),
        ),
      });
    });

    test('item not in collection', () => {
      const collection = new Collection(getUserKey, compareUsers, USERS_LIST);
      const removed = collection.remove(99);

      expect(removed).toBe(false);
      expect(collection.toData()).toEqual({
        ids: USERS_LIST.map((u) => u.id),
        index: USERS_INDEX,
      });
    });
  });
});
