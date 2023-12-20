import type { Tables } from '../test/fixtures.js';
import {
  SCHEMA,
  USERS_INDEX,
  USERS_LIST,
  compareUsers,
} from '../test/fixtures.js';
import createStore from './createStore.js';
import { deleteDatabase } from '@indb/database';
import { renderHook, waitFor } from '@testing-library/preact';
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
          store.useCount('users', { path: 'lastName', value: 'A' }),
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

  describe('useSlice', () => {
    describe('no index', () => {
      test('has the correct data', async () => {
        const { result } = renderHook(() =>
          store.useSlice('users', compareUsers),
        );

        await waitFor(() => expect(result.current.index).toEqual(USERS_INDEX));

        const newUser = { id: 10, firstName: 'A', lastName: 'Z' };

        await store.database.put('users', newUser);

        await waitFor(() =>
          expect(result.current.index).toEqual({
            ...USERS_INDEX,
            [newUser.id]: newUser,
          }),
        );

        await store.database.delete('users', newUser.id);

        await waitFor(() => expect(result.current.index).toEqual(USERS_INDEX));
      });
    });

    describe('index', () => {
      test('has the correct data', async () => {
        const { result } = renderHook(() =>
          store.useSlice('users', compareUsers, {
            path: 'lastName',
            value: 'B',
          }),
        );

        const bUsers = USERS_LIST.filter((user) => user.lastName === 'B');
        const bUserIndex = Object.fromEntries(
          bUsers.map((user) => [user.id, user]),
        );

        await waitFor(() => expect(result.current.index).toEqual(bUserIndex));

        const newUser = { id: 10, firstName: 'Z', lastName: 'B' };

        await store.database.put('users', newUser);

        await waitFor(() =>
          expect(result.current.index).toEqual({
            ...bUserIndex,
            [newUser.id]: newUser,
          }),
        );

        await store.database.delete('users', newUser.id);

        await waitFor(() => expect(result.current.index).toEqual(bUserIndex));
      });
    });
  });

  describe('useEntity', () => {
    test('status is FOUND and has entity when found', async () => {
      const { result } = renderHook(() => store.useEntity('users', 1));

      // Starts out as loading
      expect(result.current).toEqual({ status: 'LOADING', entity: undefined });

      // Eventually found
      await waitFor(() =>
        expect(result.current).toEqual({
          status: 'FOUND',
          entity: USERS_INDEX[1],
        }),
      );
    });

    test('status is NOT_FOUND entity when entity not found', async () => {
      const { result } = renderHook(() => store.useEntity('users', 100));

      // Starts out as loading
      expect(result.current).toEqual({
        status: 'LOADING',
        entity: undefined,
      });

      // Eventually not found
      await waitFor(() =>
        expect(result.current).toEqual({
          status: 'NOT_FOUND',
          entity: undefined,
        }),
      );
    });

    test('entity updates with database', async () => {
      const key = 1;
      const { result } = renderHook(() => store.useEntity('users', key));

      // Starts out as loading
      expect(result.current).toEqual({ status: 'LOADING', entity: undefined });

      // Eventually found
      await waitFor(() =>
        expect(result.current).toEqual({
          status: 'FOUND',
          entity: USERS_INDEX[key],
        }),
      );

      // Update and check matching
      await store.database.update('users', key, {
        firstName: 'ZZ',
        lastName: 'YY',
      });

      await waitFor(() =>
        expect(result.current).toEqual({
          status: 'FOUND',
          entity: { id: key, firstName: 'ZZ', lastName: 'YY' },
        }),
      );

      // Delete sets to not found
      await store.database.delete('users', key);

      await waitFor(() =>
        expect(result.current).toEqual({
          status: 'NOT_FOUND',
          entity: undefined,
        }),
      );
    });
  });
});
