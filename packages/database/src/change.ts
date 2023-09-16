import type { Key } from './keyPath';

export type TransactionChange =
  | { type: 'created' | 'updated'; storeName: string; obj: unknown }
  | { type: 'deleted'; storeName: string; key: Key };

export type StoreChange = {
  storeName: string;
  created?: unknown[];
  updated?: unknown[];
  deleted?: Key[];
};

export const mapTransactionChangesToStoreChanges = (
  transactionChanges: TransactionChange[],
): StoreChange[] => {
  const storeChangeMap = new Map<string, StoreChange>();

  for (const transactionChange of transactionChanges) {
    const { storeName, type } = transactionChange;
    let storeChange = storeChangeMap.get(storeName);

    if (!storeChange) {
      storeChange = { storeName };
      storeChangeMap.set(storeName, storeChange);
    }

    switch (type) {
      case 'created':
        {
          if (!storeChange.created) {
            storeChange.created = [];
          }
          storeChange.created.push(transactionChange.obj);
        }
        break;
      case 'updated':
        {
          if (!storeChange.updated) {
            storeChange.updated = [];
          }
          storeChange.updated.push(transactionChange.obj);
        }
        break;
      case 'deleted':
        {
          if (!storeChange.deleted) {
            storeChange.deleted = [];
          }
          storeChange.deleted.push(transactionChange.key);
        }
        break;
      default:
        throw new Error(`Unhandled TransactionChange type: ${type}`);
    }
  }

  return [...storeChangeMap.values()];
};
