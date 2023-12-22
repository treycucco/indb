# @indb/react

The react package provides a `createStore` method that returns a `Database`
instance and several hooks for working with stores from
[@indb/stores](https://www.npmjs.com/package/@indb/stores).

[API Docs](./docs/api/index.html)

## Example

Working with `createStore` looks like this:

`store.ts`

```typescript
import { type SchemaDefinition } from '@indb/database';
import { createStore } from '@indb/react';

type User = {
  id: string;
  firstName: string;
  lastName: string;
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
    },
  },
};

const { database, useSlice } = createStore<Tables>(DATABASE_NAME, SCHEMA);

export { database, useSlice };
```

`UsersList.tsx`

```tsx
import UserListItem from './UserListItem';
import { type User, useSlice } from './store.ts';

const compareUsers = (left: User, right: User) => {
  const comp = left.lastName.localeCompare(right.lastName);
  return comp === 0 ? left.firstName.localeCompare(right.firstName) : comp;
};

const UsersList = () => {
  const { ids: userIds, index: usersIndex } = useSlice('users', compareUsers);

  return (
    <>
      {userIds.map((userId) => (
        <UserListItem user={usersIndex[userId]!} key={userId} />
      ))}
    </>
  );
};

export default UsersList;
```
