# @indb/database

The database package exposes a type-safe, promise-based wrapper around the
IndexedDB API.

## Example

An example database looks something like this:

```typescript
import { Database, type SchemaDefinition } from '@indb/database';

type Todo = {
  id: string;
  listId: string;
  title: string;
  createdAt: number;
};

type List = {
  id: string;
  title: string;
};

type Tables = {
  todos: Todo;
  lists: List;
};

const DATABASE_NAME = 'todos';
const SCHEMA: SchemaDefinition<Tables> = {
  version: 1,
  stores: {
    lists: {
      keyPath: 'id',
    },
    todos: {
      keyPath: 'id',
      indices: {
        listId: {},
      },
    },
  },
};

const database = new Database<Tables>(DATABASE_NAME, SCHEMA);
```

This creates a new database, and will create the `lists` and `todos` stores, as
well as a `listId` index on the `todos` store, so you can easily pull all the
`todos` that are related to a specific `list`.

## Features

### Automatic Schema Migrations

Schemas are defined giving names of stores, key paths, and indices, and whenever
the version of the schema is changed `@indb/database` will diff the current
state of the schema and the requested schema and make the desired changes.

Schemas are type-safe, in that they must define table definitions for all of the
types registered with the database.

### Type-safe

The `Tables` type passed to the database will make sure you only interact with
tables named in the type, and will cast all data from the associated tables with
that type.

Additionally, schema definitions requre that each table have a definition, and
that the key and index paths are valid paths (even deep paths are checked).

### Promise-based

All of the actions you can take on the database return Promises, so you don't
have to work with the lower-level `onerror` and `oncomplete` etc. handlers of
the various objects produced by calls to the IndexedDB API.

### Event Dispatching

Every mutation to the database dispatches an action that can be listened for via
a handler on `database.addEventListener('changed', handler)`. Additionally,
every change to the database will also dispatch an event on a `BroadcastChannel`
that other instances of `Database` in other tabs and windows will listen to.

So, `Database` instances act as event aggregators for all other `Database`
instances, meaning that changes in other tabs or windows will dispatch events in
others, allowing data to keep up to date no matter where the actions occur.

The [stores package](../stores) provides some classes that are designed to
efficiently keep in-memory representations of parts of the database by using
this event dispatching functionality.
