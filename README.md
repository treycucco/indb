# @indb

@indb is a collection of packages designed to make working with IndexedDB
convenient with reactive UI libraries such as React and Preact.

## Non-Goals

This package collection is not seeking to provide access to the full
functionality of IndexedDB.

## Packages

### @indb/database

The database package provides a type-safe, promise-based wrapper around 
IndexedDB for the most common actions, such as:

- Creating a new database
- Migrating a database
- CRUD operations

In addition to providing access to database functionality, all changes to the
database that occur through the `Database` class dispatch events, allowing
listeners to know of all changes to the underlying database.

The `Database` class also communicates changes on a `BroadcastChannel` so that
all instances for the same origin will know of changes that occurred.

See [the package](./packages/database) for more information.

### @indb/stores

The stores package provides several in-memory stores that sit in front of the
database and update their representation of the data based on events dispatched
by a `Database` instance.

These stores are designed to be easily used with React's `useSyncExternalStore`
hook -- they provide `subscribe` and `getSnapshot` methods that can be passed
directly to that hook

The stores provided include:

- `Slice` a class that keeps an ordered list of items from an Object Store. The
  slice can optionally focus on an Index rather than the entire store.
- `Counter` a class that keeps count of how many records are in an object store,
  optionally filtered down by an index.

See [the package](./packages/stores) for more information.

### @indb/react, @indb/preact

The react and preact packages provide `createStore` methods that initializes a
database and creates hooks that synchronize with stores from the `@indb/stores`
package.

For instance, `createStore` returns a `useSlice` hook that uses
`useSyncExternalStore` to keep a fresh memory representation of an object store.

See [the react package](./packages/react) and
[the preact package](./packages/preact) for more information.

## Sample Project

See [InDB Todo](https://treycucco.github.io/indb-todo/) for a sample React
project that uses this package.
