# @indb/stores

The stores packages exposes several classes that keep an in-memory
representation of some part of the database. These in-memory stores are kept
up-to-date with the underlying database by subscribing to the `change` events
the database instance dispatches.

Additionally, since the `database` instances act as event aggregators for all
instances of the database, these in-memory stores stay up to date even when
changes occur in other tabs or windows.

## Example

An example store looks something like this:

```typescript
import { Database, type SchemaDefinition } from '@indb/database';

type FavoriteColor = 'red' | 'green' | 'blue';

type User = {
  id: string;
  firstName: string;
  lastName: string;
  favorite: {
    color: FavoriteColor;
  };
};

type Tables = {
  users: User;
};

const DATABASE_NAME = 'app';
const SCHEMA: SchemaDefinition<Tables> = {
  version: 1,
  stores: {
    users: {
      keyPath: 'id',
      indices: {
        'lastName': {},
        'favorite.color': {},
      },
    },
  },
};

const database = new Database<Tables>(DATABASE_NAME, SCHEMA);

export const compareUsers = (left: User, right: User): number => {
  const last = left.lastName.localeCompare(right.lastName);
  if (last === 0) {
    return left.firstName.localeCompare(right.firstName);
  }
  return last;
};

// A slice representing all users:
const allUsers = new Slice({
  database,
  storeName: 'users',
  compare: compareUsers,
});

// A slice representing all users whose favorite color is blue:
const blueUsers = new Slice({
  database,
  storeName: 'users',
  compare: compareUsers,
  index: {
    path: 'favorite.color',
    value: 'blue',
  },
});

const smithsCounter = new Counter({
  database,
  storeName: 'users',
  index: {
    path: 'lastName',
    value: 'Smith',
  },
});
```

## Stores

### Slice

The slice store represents an ordered-list of objects from an object store. It
may be all of the objects in the store, or only those that match an index value.

The slice represents these objects in a `Collection` data store that is kept
up-to-date by subscribing to events from the database object.

The `getSnapshot` method returns a POJO data structure that looks like:

```typescript
type CollectionData<T> = {
  ids: Key[];
  index: Record<Key, T>;
};
```

And the `ids` list is sorted based on sorting the objects with the `compare`
function.

### Counter

The counter store represents a count of objects from a store. It may count all
the objects in the store, or just those in an index that match a specific value.

The `getSnapshot` method returns the count.

## UseSyncExternalStore

All of the store classes in this package can be used with `useSyncExternalStore`
directly:

```typescript
const snapshot = useSyncExternalStore(slice.subscribe, slice.getSnapshot);
```

The [react package](https://www.npmjs.com/package/@indb/react) provides some
ready-made hooks for working with slices and counters.
