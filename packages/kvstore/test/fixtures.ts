import type { SchemaDefinition } from '@indb/database';

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
