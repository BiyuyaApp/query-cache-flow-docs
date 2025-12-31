# CRUD Factory

The `createQueryGroupCRUD` function is the heart of Query Cache Flow. It generates a complete set of query keys, invalidation rules, and normalization functions for an entity in a single line of code.

## Function Signature

```typescript
export const createQueryGroupCRUD = <T = string>(
  entityName: string,
): QueryGroupCRUD<T>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityName` | `string` | The name of the entity (e.g., 'accounts', 'transactions') |
| `T` | Generic | The type of the entity's ID (defaults to `string`) |

### Returns

```typescript
interface QueryGroupCRUD<T> {
  all: QueryGroup<T>;
  list: QueryGroup<T>;
  detail: QueryGroupResolved<T>;
  create: QueryGroup<T>;
  update: QueryGroupMutationResolved<T>;
  remove: QueryGroupMutationResolved<T>;
}
```

## Basic Usage

```typescript
import { createQueryGroupCRUD } from 'src/queries';

// Create query group for accounts
const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');
```

This single line generates all six operations:

## Generated Operations

### 1. All

Matches all queries for this entity (useful for invalidating everything):

```typescript
all: {
  queryKey: { entity: 'accounts' }
}
```

Usage:

```typescript
// Invalidate all account queries
invalidateQueriesForKeys([accountsQueryGroup.all.queryKey]);
```

### 2. List

Fetches all records of this entity:

```typescript
list: {
  queryKey: { entity: 'accounts', method: 'list' },
  type: 'query'
}
```

Usage:

```typescript
useQuery({
  queryKey: [accountsQueryGroup.list.queryKey],
  queryFn: fetchAccounts,
});
```

### 3. Detail

Fetches a single record by ID:

```typescript
detail: {
  queryKey: (id: T) => ({ entity: 'accounts', method: 'detail', id }),
  type: 'query',
  normalize: (data: any) => {
    // Updates the item in list cache
    queryClient.setQueryData([list.queryKey], (old: any) => {
      if (!old) return old;
      return old.map((item: any) => (item.id === data.id ? data : item));
    });
  }
}
```

Usage:

```typescript
useQuery({
  queryKey: [accountsQueryGroup.detail.queryKey('123')],
  queryFn: () => fetchAccount('123'),
});
```

### 4. Create

Creates a new record:

```typescript
create: {
  queryKey: { entity: 'accounts', method: 'create' },
  invalidates: { entity: 'accounts', method: 'list' },
  type: 'mutation',
  normalize: (data: { id: any }) => {
    // Adds new item to list cache
    queryClient.setQueryData([list.queryKey], (old: any) => {
      if (!old) return [data];
      return [...old, data];
    });
    // Sets detail cache for new item
    queryClient.setQueryData([detail.queryKey(data.id)], data);
  }
}
```

Usage:

```typescript
useMutation({
  mutationFn: createAccount,
  onSuccess: (data) => {
    accountsQueryGroup.create.normalize?.(data);
    invalidateQueriesForKeys([accountsQueryGroup.create.invalidates]);
  },
});
```

### 5. Update

Updates an existing record:

```typescript
update: {
  queryKey: (id: T) => ({ entity: 'accounts', method: 'update', id }),
  invalidates: (id: T) => [
    { entity: 'accounts', id },
    { entity: 'accounts', method: 'list' }
  ],
  type: 'mutation',
  normalize: (data: { id: any }) => {
    // Updates item in list cache
    queryClient.setQueryData([list.queryKey], (old: any) => {
      if (!old) return old;
      return old.map((item: any) => (item.id === data.id ? data : item));
    });
    // Updates detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], data);
  }
}
```

Usage:

```typescript
useMutation({
  mutationFn: ({ id, data }) => updateAccount(id, data),
  onSuccess: (data, variables) => {
    accountsQueryGroup.update.normalize?.(data);
    invalidateQueriesForKeys(accountsQueryGroup.update.invalidates(variables.id));
  },
});
```

### 6. Remove

Deletes a record:

```typescript
remove: {
  queryKey: (id: T) => ({ entity: 'accounts', method: 'remove', id }),
  invalidates: (id: T) => [
    { entity: 'accounts', id },
    { entity: 'accounts', method: 'list' }
  ],
  type: 'mutation',
  normalize: (data: { id: any }) => {
    // Removes item from list cache
    queryClient.setQueryData([list.queryKey], (old: any) => {
      if (!old) return old;
      return old.filter((item: any) => item.id !== data.id);
    });
    // Clears detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], undefined);
  }
}
```

Usage:

```typescript
useMutation({
  mutationFn: (id: string) => deleteAccount(id),
  onSuccess: (data, id) => {
    accountsQueryGroup.remove.normalize?.({ id });
    invalidateQueriesForKeys(accountsQueryGroup.remove.invalidates(id));
  },
});
```

## Type Parameters

### String IDs (Default)

```typescript
const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');

// ID parameter must be string
accountsQueryGroup.detail.queryKey('123');  // OK
accountsQueryGroup.detail.queryKey(123);    // Error
```

### Number IDs

```typescript
const postsQueryGroup = createQueryGroupCRUD<number>('posts');

// ID parameter must be number
postsQueryGroup.detail.queryKey(123);    // OK
postsQueryGroup.detail.queryKey('123');  // Error
```

### Custom ID Types

```typescript
type UUID = string & { __brand: 'UUID' };

const usersQueryGroup = createQueryGroupCRUD<UUID>('users');

const userId: UUID = 'abc-123-def' as UUID;
usersQueryGroup.detail.queryKey(userId);  // OK
```

## Cascade Invalidation

CRUD factory includes smart cascade invalidation:

| Operation | Invalidates |
|-----------|-------------|
| `create` | `list` only |
| `update` | `list` + specific item (`{ entity, id }`) |
| `remove` | `list` + specific item (`{ entity, id }`) |

Example:

```typescript
// Updating account '123' invalidates:
// 1. { entity: 'accounts', id: '123' } (all queries for this account)
// 2. { entity: 'accounts', method: 'list' } (the list query)

accountsQueryGroup.update.invalidates('123');
// Returns: [
//   { entity: 'accounts', id: '123' },
//   { entity: 'accounts', method: 'list' }
// ]
```

## Optimistic Updates

Each mutation includes a `normalize` function for optimistic UI updates:

```typescript
// Create: Adds to list immediately
create.normalize({ id: '123', name: 'New Account' });

// Update: Updates in list and detail
update.normalize({ id: '123', name: 'Updated Name' });

// Remove: Removes from list
remove.normalize({ id: '123' });
```

These run **before** invalidation, giving instant UI feedback.

## Extending CRUD Groups

You can extend the generated CRUD with custom operations:

```typescript
const accountsQueryGroup = {
  ...createQueryGroupCRUD<string>('accounts'),

  // Custom: Search accounts
  search: {
    queryKey: (query: string) => ({
      entity: 'accounts',
      method: 'search',
      query
    }),
    type: 'query' as const,
  },

  // Custom: Bulk delete
  bulkDelete: {
    queryKey: { entity: 'accounts', method: 'bulkDelete' },
    invalidates: { entity: 'accounts' },  // Invalidate everything
    type: 'mutation' as const,
  },
};
```

## When NOT to Use CRUD Factory

Skip the CRUD factory for:

### Read-Only Entities

```typescript
// Better: Simple query group
const currenciesQueryGroup = {
  list: {
    queryKey: { entity: 'currencies', method: 'list' },
  },
};
```

### Highly Custom Operations

```typescript
// Better: Manual definition
const reportsQueryGroup = {
  generate: {
    queryKey: (params) => ({ entity: 'reports', params }),
    type: 'query',
  },
  download: {
    queryKey: (id) => ({ entity: 'reports', method: 'download', id }),
    type: 'mutation',
  },
};
```

## Best Practices

### 1. Use Consistent Entity Names

```typescript
// Good
createQueryGroupCRUD('accounts');
createQueryGroupCRUD('transactions');

// Bad - inconsistent casing
createQueryGroupCRUD('Accounts');
createQueryGroupCRUD('transaction');
```

### 2. Specify ID Type

```typescript
// Good - explicit type
createQueryGroupCRUD<string>('accounts');
createQueryGroupCRUD<number>('posts');

// OK - defaults to string
createQueryGroupCRUD('accounts');
```

### 3. One Entity Per Factory Call

```typescript
// Good
const accountsQueryGroup = createQueryGroupCRUD('accounts');
const usersQueryGroup = createQueryGroupCRUD('users');

// Bad - don't reuse
const queryGroup = createQueryGroupCRUD('mixed'); // What entity is this?
```

## Implementation Details

The CRUD factory leverages the `resolveKey` helper to handle both static and dynamic keys:

```typescript
const resolveKey = <T>(
  key: QueryKey<T> | ((...args: T[]) => QueryKey<T>),
  ...args: T[]
): QueryKey<T> => {
  return typeof key === 'function' ? key(...args) : key;
};
```

This allows `normalize` functions to work with both:
- Static keys: `list.queryKey`
- Dynamic keys: `detail.queryKey(id)`

## Next Steps

- [Key Injection](key-injection) - Add shared context to CRUD groups
- [Wrapper Hooks](../patterns/wrapper-hooks) - Use CRUD in real components
- [Optimistic Updates](../patterns/optimistic-updates) - Leverage normalize functions
