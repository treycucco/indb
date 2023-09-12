import type { PathType, PathsToProps } from './types';

/**
 * Accepted types for store and index key paths.
 *
 * This is more restrictive than IDBValidKey because we want to be able to represent stores in
 * memory as plain objects.
 */
export type Key = string | number;

export type KeyExtractor<T> = (obj: T) => Key;

/**
 * Resolves to all dotted paths on an object that can be used as a store or index key path.
 */
export type ValidKeyPaths<ObjectType> = PathsToProps<ObjectType, Key>;

/**
 * Resolves to the type for the path if the type extends Key. Otherwise never.
 */
export type ValidKeyPath<Value, Path> = Path extends string
  ? PathType<Value, Path> extends Key
    ? PathType<Value, Path>
    : never
  : never;

const pathCache = new Map<string, string[]>();

/**
 * Get an object's keyPath value.
 *
 * Key paths must be dot-separated paths to valid keys.
 */
export const getKeyPathValue = <
  ObjectType extends object,
  KeyPath extends ValidKeyPaths<ObjectType>,
>(
  obj: ObjectType,
  path: KeyPath,
): ValidKeyPath<ObjectType, KeyPath> => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (!pathCache.has(path)) {
    pathCache.set(path, path.split('.'));
  }

  const steps = pathCache.get(path)!;

  if (steps.length === 1) {
    return obj[steps[0] as keyof ObjectType] as ValidKeyPath<
      ObjectType,
      KeyPath
    >;
  }

  let current: unknown = obj;
  for (const step of steps) {
    if (current === null || current === undefined) {
      return current as ValidKeyPath<ObjectType, KeyPath>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current = (current as any)[step as keyof typeof obj];
  }

  return current as ValidKeyPath<ObjectType, KeyPath>;
};
