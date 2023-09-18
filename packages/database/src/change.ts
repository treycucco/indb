import type { Key } from './keyPath';

export type TransactionChange =
  | { type: 'created' | 'updated'; storeName: string; obj: unknown }
  | { type: 'deleted'; storeName: string; key: Key };

export type StoreChange =
  | { type: 'created' | 'updated'; obj: unknown }
  | { type: 'deleted'; key: Key };

export type StoreChanges = {
  storeName: string;
  changes: StoreChange[];
};

export const mapTransactionChangesToStoreChanges = (
  transactionChanges: TransactionChange[],
): StoreChanges[] => {
  const storeChangeMap = new Map<string, StoreChanges>();

  for (const transactionChange of transactionChanges) {
    const { type, storeName } = transactionChange;
    let storeChanges = storeChangeMap.get(storeName);

    if (!storeChanges) {
      storeChanges = { storeName, changes: [] };
      storeChangeMap.set(storeName, storeChanges);
    }

    switch (type) {
      case 'created':
      case 'updated':
        storeChanges.changes.push({ type, obj: transactionChange.obj });
        break;
      case 'deleted':
        storeChanges.changes.push({ type, key: transactionChange.key });
        break;
      default:
        throw new Error(`Unhandled TransactionChange type: ${type}`);
    }
  }

  return [...storeChangeMap.values()];
};
