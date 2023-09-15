import type { Tables } from '../test/fixtures';
import {
  SCHEMA,
  USERS_INDEX,
  USERS_LIST,
  compareUsers,
} from '../test/fixtures';
import createStore from './createStore';
import { deleteDatabase } from '@indb/database';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe(createStore, () => {
  let dbName: string;
  let store: ReturnType<typeof createStore<Tables>>;

  beforeEach(async () => {
    dbName = crypto.randomUUID();
    store = createStore<Tables>(dbName, SCHEMA);
    await store.database.putMany('users', USERS_LIST);
  });

  afterEach(async () => {
    await deleteDatabase(dbName);
  });

  describe('useCount', () => {
    describe('no index', () => {
      test('returns the correct count', async () => {
        const { result } = renderHook(() => store.useCount('users'));

        await waitFor(() => expect(result.current).toBe(9));

        await store.database.put('users', {
          id: 10,
          firstName: 'Z',
          lastName: 'Z',
        });

        await waitFor(() => expect(result.current).toBe(10));

        await store.database.delete('users', 10);

        await waitFor(() => expect(result.current).toBe(9));
      });
    });

    describe('index', () => {
      test('returns the correct count', async () => {
        const { result } = renderHook(() =>
          store.useCount('users', 'lastName', 'A'),
        );

        await waitFor(() => expect(result.current).toBe(2));

        await store.database.put('users', {
          id: 10,
          firstName: 'Z',
          lastName: 'A',
        });

        await waitFor(() => expect(result.current).toBe(3));

        await store.database.delete('users', 10);

        await waitFor(() => expect(result.current).toBe(2));
      });
    });
  });

  describe('useStore', () => {
    describe('no index', () => {
      test('has the correct data', async () => {
        const { result } = renderHook(() =>
          store.useSlice('users', compareUsers),
        );

        await waitFor(() =>
          expect(result.current.data.index).toEqual(USERS_INDEX),
        );

        const newUser = { id: 10, firstName: 'A', lastName: 'Z' };

        await store.database.put('users', newUser);

        await waitFor(() =>
          expect(result.current.data.index).toEqual({
            ...USERS_INDEX,
            [newUser.id]: newUser,
          }),
        );

        await store.database.delete('users', newUser.id);

        await waitFor(() =>
          expect(result.current.data.index).toEqual(USERS_INDEX),
        );
      });
    });

    describe('index', () => {
      test('has the correct data', async () => {
        const { result } = renderHook(() =>
          store.useSlice('users', compareUsers, 'lastName', 'B'),
        );

        const bUsers = USERS_LIST.filter((user) => user.lastName === 'B');
        const bUserIndex = Object.fromEntries(
          bUsers.map((user) => [user.id, user]),
        );

        await waitFor(() =>
          expect(result.current.data.index).toEqual(bUserIndex),
        );

        const newUser = { id: 10, firstName: 'Z', lastName: 'B' };

        await store.database.put('users', newUser);

        await waitFor(() =>
          expect(result.current.data.index).toEqual({
            ...bUserIndex,
            [newUser.id]: newUser,
          }),
        );

        await store.database.delete('users', newUser.id);

        await waitFor(() =>
          expect(result.current.data.index).toEqual(bUserIndex),
        );
      });
    });
  });
});
