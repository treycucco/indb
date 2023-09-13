import type { SchemaDefinition } from '@indb/database';

type User = {
  id: number;
  firstName: string;
  lastName: string;
};

export type Tables = {
  users: User;
};

export const SCHEMA: SchemaDefinition<Tables> = {
  version: 1,
  stores: {
    users: {
      keyPath: 'id',
      indices: {
        lastName: {},
      },
    },
  },
};

export const USERS_LIST: Array<User> = Object.freeze([
  { id: 1, firstName: 'A', lastName: 'A' },
  { id: 2, firstName: 'B', lastName: 'A' },
  { id: 3, firstName: 'A', lastName: 'B' },
  { id: 4, firstName: 'B', lastName: 'B' },
  { id: 5, firstName: 'A', lastName: 'C' },
  { id: 6, firstName: 'B', lastName: 'C' },
  { id: 7, firstName: 'A', lastName: 'D' },
  { id: 8, firstName: 'B', lastName: 'D' },
  { id: 9, firstName: 'A', lastName: 'E' },
]).map((user) => Object.freeze(user));

export const USERS_INDEX: Record<number, User> = Object.freeze(
  Object.fromEntries(USERS_LIST.map((user) => [user.id, user])),
);

export const compareUsers = (left: User, right: User): number => {
  const last = left.lastName.localeCompare(right.lastName);
  if (last === 0) {
    return left.firstName.localeCompare(right.firstName);
  }
  return last;
};

export const getUserKey = (user: User) => user.id;
