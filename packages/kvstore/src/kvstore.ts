import type { Database } from '@indb/database';

export interface KVStoreEntry {
  key: string;
  data: unknown;
}
export interface KVStoreTable {
  kvstore: KVStoreEntry;
}

export default class KVStore<
  Tables extends KVStoreTable,
  Entries extends object,
> {
  private readonly database: Database<Tables>;

  constructor(database: Database<Tables>) {
    this.database = database;
  }

  async get<EntryKey extends keyof Entries>(
    key: EntryKey,
  ): Promise<Entries[EntryKey] | undefined> {
    // @ts-expect-error StoreNames<Tables> is recognizing that Tables must extend KVStoreTable.
    const value = await this.database.get('kvstore', key);
    if (value === undefined) {
      return undefined;
    }
    return value.data as Entries[EntryKey];
  }

  async set<EntryKey extends keyof Entries>(
    key: EntryKey,
    data: Entries[EntryKey],
  ): Promise<void> {
    // @ts-expect-error StoreNames<Tables> is recognizing that Tables must extend KVStoreTable.
    return this.database.put('kvstore', { key, data });
  }

  async has<EntryKey extends keyof Entries>(key: EntryKey): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  async delete<EntryKey extends keyof Entries>(key: EntryKey): Promise<void> {
    // @ts-expect-error StoreNames<Tables> is recognizing that Tables must extend KVStoreTable.
    return this.database.delete('kvstore', key);
  }

  // TODO: Consider providing some means of getting a lock based on the key name so something can
  //       be done atomically?
  // TODO: Consider adding an atomic getset using that?
}
