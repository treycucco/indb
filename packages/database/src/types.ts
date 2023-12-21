/**
 * Resolves to the type of a property in deeply nested objects via a dot-separated path
 *
 * E.G.
 *
 * const obj = {
 *   a: 1,
 *   b: {
 *     c: 'two',
 *     d: [1, 2, 3],
 *   }
 * };
 *
 * PathType<typeof obj, 'a'> is number
 * PathType<typeof obj, 'b.c'> is string
 * PathType<typeof obj, 'b.d'> is array
 *
 * Inspired by https://stackoverflow.com/a/64578478
 */
export type PathType<Value, Path extends string> = Value extends object
  ? Path extends keyof Value
    ? Value[Path]
    : Path extends `${infer Head}.${infer Tail}`
      ? Head extends keyof Value
        ? // TODO: also check for null?
          undefined extends Value[Head]
          ? PathType<Value[Head], Tail> | undefined
          : PathType<Value[Head], Tail>
        : never
      : never
  : never;

/**
 * If the path is valid for the type, the path value is the type.
 *
 * E.G.
 *
 * type User = { name: string; favorite: { color: string } }
 *
 * ValidatePath<User, 'name'> is 'name'
 * ValidatePath<User, 'favorite.color'> is 'favorite.color'
 * ValidatePath<User, 'favorite.food'> is never
 */
export type ValidatePath<Value, Path> = Path extends string
  ? PathType<Value, Path> extends never
    ? never
    : Path
  : never;

/**
 * Get a list of all dotted paths for the type where the property value types
 * match a list of types.
 *
 * E.G.
 *
 * type User = { name: string; age: number; favorite: { color: string; day: Date } }
 *
 * PathsToProps<User, string> is 'name' | 'favorite.color'
 * Inspired by https://stackoverflow.com/a/73179989
 */
export type PathsToProps<Value, PropertyType> = Value extends PropertyType
  ? ''
  : {
      [Key in Extract<keyof Value, string>]: Dot<
        Key,
        PathsToProps<Value[Key], PropertyType>
      >;
    }[Extract<keyof Value, string>];

type Dot<Head extends string, Tail extends string> = '' extends Tail
  ? Head
  : `${Head}.${Tail}`;
