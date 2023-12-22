# @indb/kvstore

This is a wrapper around `@indb/database` that acts as a type-safe key-value
store.

[API Docs](./docs/api/index.html)

## Restrictions

Your `@indb/database` schema must include an object store called `kvstore` and
its type must extend `{ key: string; data: unknown }`.

## Example

```typescript
import { Database, type SchemaDefinition } from '@indb/database';
import { KVStore } from '@indb/kvstore';

export type User = { id: number; firstName: string; lastName: string };
export type SortOrder = { field: string; direction: 'asc' | 'desc' };
export type Operator = '=' | '>' | '<' | '!=';
export type Filter = {
  field: string;
  value: string | number;
  operator: Operator;
};

export type KVEntry = {
  me: User;
  apiToken: string;
  sortOrder: SortOrder[];
  filters: Filter[];
  attempts: number;
};

export type Tables = {
  users: User;
  kvstore: { key: string; data: KVEntry[keyof KVEntry] };
};

export const SCHEMA: SchemaDefinition<Tables> = {
  version: 1,
  stores: {
    users: {
      keyPath: 'id',
    },
    kvstore: {
      keyPath: 'key',
    },
  },
};

const database = new Database<Tables>();
const kvStore = new KVStore<Tables, KVEntry>(database);

await kvStore.set('user', { id: 1, firstName: 'some', lastName: 'one' });
await kvStore.set('filters', [{ field: 'age', value: 30, operator: '>' }]);
await kvStore.set('attempts', 13);

const user = await kvStore.get('user');

// etc.
```
