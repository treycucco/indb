import type { SchemaDefinition } from "../src/schema";

export type User = {
  id: number;
  firstName: string;
  lastName: string;
  favorite?: {
    color?: string;
    animal?: string;
  };
};

export type Tables = {
  users: User;
};

export const SCHEMA: SchemaDefinition<Tables> = {
  version: 1,
  stores: {
    users: {
      keyPath: "id",
      indices: {
        lastName: {},
        "favorite.color": {},
      },
    },
  },
};

export const USERS_LIST: Array<User> = Object.freeze([
  {
    id: 1,
    firstName: "A",
    lastName: "A",
    favorite: { color: "red", animal: "dog" },
  },
  {
    id: 2,
    firstName: "B",
    lastName: "A",
    favorite: { color: "green", animal: "cat" },
  },
  {
    id: 3,
    firstName: "A",
    lastName: "B",
    favorite: { color: "blue", animal: "bird" },
  },
  {
    id: 4,
    firstName: "B",
    lastName: "B",
    favorite: { color: "blue", animal: "lizard" },
  },
  {
    id: 5,
    firstName: "A",
    lastName: "C",
    favorite: { animal: "hamster" },
  },
  {
    id: 6,
    firstName: "B",
    lastName: "C",
    favorite: { color: "blue" },
  },
  { id: 7, firstName: "A", lastName: "D" },
  { id: 8, firstName: "B", lastName: "D" },
  { id: 9, firstName: "A", lastName: "E" },
]).map((user) => Object.freeze(user));

export const USERS_INDEX: Record<number, User> = Object.freeze(
  Object.fromEntries(USERS_LIST.map((user) => [user.id, user]))
);

export const compareUsers = (left: User, right: User): number => {
  const last = left.lastName.localeCompare(right.lastName);
  if (last === 0) {
    return left.firstName.localeCompare(right.firstName);
  }
  return last;
};

export const getUserKey = (user: User) => user.id;
