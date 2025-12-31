# createQueryGroupCRUD

The core factory function that generates a complete set of CRUD operations with proper query keys, invalidation logic, and normalization functions.

## Type Signature

```typescript
export const createQueryGroupCRUD = <T = string>(
  entityName: string,
): QueryGroupCRUD<T>
```

## Parameters

### `entityName`

- **Type**: `string`
- **Required**: Yes
- **Description**: The name of the entity (e.g., 'accounts', 'transactions', 'users')

### `T` (Generic Type)

- **Type**: Type parameter
- **Default**: `string`
- **Description**: The type of the entity's ID (e.g., `string`, `number`, `Account['id']`)

## Return Type

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

## Generated Operations

### `all`

Represents all entities without filtering.

```typescript
{
  queryKey: { entity: entityName }
}
```

**Use case**: Invalidating or canceling all queries for an entity.

### `list`

Represents a list/collection query.

```typescript
{
  queryKey: { entity: entityName, method: 'list' },
  type: 'query'
}
```

**Use case**: Fetching all records, with optional filtering/pagination in wrapper hooks.

### `detail`

Represents fetching a single entity by ID.

```typescript
{
  queryKey: (id: T) => ({ entity: entityName, method: 'detail', id }),
  type: 'query',
  normalize: (data) => {
    // Updates the item in the list cache
    queryClient.setQueryData([list.queryKey], (old) => {
      if (!old) return old;
      return old.map((item) => (item.id === data.id ? data : item));
    });
  }
}
```

**Features**:
- **Dynamic key**: Function that takes an ID
- **Normalization**: Automatically updates the list cache when detail data changes

### `create`

Represents creating a new entity.

```typescript
{
  queryKey: { entity: entityName, method: 'create' },
  invalidates: { entity: entityName, method: 'list' },
  type: 'mutation',
  normalize: (data) => {
    // Add new item to list cache
    queryClient.setQueryData([list.queryKey], (old) => {
      if (!old) return [data];
      return [...old, data];
    });
    // Set detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], data);
  }
}
```

**Features**:
- **Invalidates**: List queries automatically
- **Normalization**: Optimistically adds new item to cache

### `update`

Represents updating an existing entity.

```typescript
{
  queryKey: (id: T) => ({ entity: entityName, method: 'update', id }),
  invalidates: (id: T) => [
    { entity: entityName, id },
    { entity: entityName, method: 'list' }
  ],
  type: 'mutation',
  normalize: (data) => {
    // Update item in list cache
    queryClient.setQueryData([list.queryKey], (old) => {
      if (!old) return old;
      return old.map((item) => (item.id === data.id ? data : item));
    });
    // Update detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], data);
  }
}
```

**Features**:
- **Dynamic key**: Function that takes an ID
- **Invalidates**: Both the specific entity and the list
- **Normalization**: Updates both list and detail caches

### `remove`

Represents deleting an entity.

```typescript
{
  queryKey: (id: T) => ({ entity: entityName, method: 'remove', id }),
  invalidates: (id: T) => [
    { entity: entityName, id },
    { entity: entityName, method: 'list' }
  ],
  type: 'mutation',
  normalize: (data) => {
    // Remove item from list cache
    queryClient.setQueryData([list.queryKey], (old) => {
      if (!old) return old;
      return old.filter((item) => item.id !== data.id);
    });
    // Clear detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], undefined);
  }
}
```

**Features**:
- **Dynamic key**: Function that takes an ID
- **Invalidates**: Both the specific entity and the list
- **Normalization**: Removes item from list cache and clears detail cache

## Basic Example

```typescript
import { createQueryGroupCRUD } from 'src/queries';

// Create a basic CRUD query group
const usersQueryGroup = createQueryGroupCRUD('users');

// Use the generated operations
console.log(usersQueryGroup.list.queryKey);
// { entity: 'users', method: 'list' }

console.log(usersQueryGroup.detail.queryKey('123'));
// { entity: 'users', method: 'detail', id: '123' }

console.log(usersQueryGroup.update.invalidates('123'));
// [
//   { entity: 'users', id: '123' },
//   { entity: 'users', method: 'list' }
// ]
```

## With TypeScript Types

```typescript
import { createQueryGroupCRUD } from 'src/queries';
import { Account } from 'src/generated';

// Use the entity's ID type for type safety
const accountsQueryGroup = createQueryGroupCRUD<Account['id']>('accounts');

// Now TypeScript enforces the correct ID type
accountsQueryGroup.detail.queryKey('string-id'); // ✓ OK if Account['id'] is string
accountsQueryGroup.detail.queryKey(123); // ✗ Error if Account['id'] is string
```

## Real-World Example

```typescript
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';
import { Transaction } from 'src/generated';

// Step 1: Create base CRUD operations
let transactionsQueryGroupCRUD = createQueryGroupCRUD<Transaction['id']>('transactions');

// Step 2: Inject authentication context
transactionsQueryGroupCRUD = inyectKeysToQueries(transactionsQueryGroupCRUD, {
  auth: true,
});

// Step 3: Export with any custom extensions
export const transactionsQueryGroup = {
  ...transactionsQueryGroupCRUD,
  // You can override or extend specific operations here
};
```

## Extending Generated Operations

You can override or extend any generated operation:

```typescript
const accountsQueryGroupCRUD = createQueryGroupCRUD<Account['id']>('accounts');

export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,

  // Override remove to cascade invalidations
  remove: {
    ...accountsQueryGroupCRUD.remove,
    invalidates: (id: Account['id']) => [
      ...accountsQueryGroupCRUD.remove.invalidates(id),
      transactionsQueryGroup.all.queryKey,
      movementsQueryGroup.all.queryKey,
    ],
  },

  // Add custom operations
  archive: {
    queryKey: (id: Account['id']) => ({ entity: 'accounts', method: 'archive', id }),
    invalidates: (id: Account['id']) => [
      { entity: 'accounts', id },
      { entity: 'accounts', method: 'list' },
    ],
    type: 'mutation',
  },
};
```

## Normalization Behavior

All mutations include a `normalize` function that provides optimistic updates:

### Create Normalization

```typescript
normalize: (data: { id: any }) => {
  // Add to list
  queryClient.setQueryData([list.queryKey], (old: any) => {
    if (!old) return [data];
    return [...old, data];
  });
  // Set detail
  queryClient.setQueryData([detail.queryKey(data.id)], data);
}
```

### Update Normalization

```typescript
normalize: (data: { id: any }) => {
  // Update in list
  queryClient.setQueryData([list.queryKey], (old: any) => {
    if (!old) return old;
    return old.map((item: any) => (item.id === data.id ? data : item));
  });
  // Update detail
  queryClient.setQueryData([detail.queryKey(data.id)], data);
}
```

### Remove Normalization

```typescript
normalize: (data: { id: any }) => {
  // Remove from list
  queryClient.setQueryData([list.queryKey], (old: any) => {
    if (!old) return old;
    return old.filter((item: any) => item.id !== data.id);
  });
  // Clear detail
  queryClient.setQueryData([detail.queryKey(data.id)], undefined);
}
```

## Integration with Wrapper Hooks

The generated query groups are designed to work seamlessly with wrapper hooks:

```typescript
// Query wrapper
export const useTransactions = () =>
  generatedTransactions({
    query: { queryKey: [transactionsQueryGroup.list.queryKey] },
  });

// Mutation wrapper with normalization
export const useTransactionCreate = ({ onSuccess, ...rest }) =>
  generatedTransactionCreate({
    mutation: {
      mutationKey: [transactionsQueryGroup.create.queryKey],
      onSuccess: (data, variables, context) => {
        // Call normalize for optimistic update
        transactionsQueryGroup.create.normalize?.(data);

        // Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: [transactionsQueryGroup.create.invalidates],
        });

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Best Practices

### 1. Use Typed IDs

Always provide the ID type for type safety:

```typescript
// GOOD
createQueryGroupCRUD<Account['id']>('accounts');

// AVOID (loses type safety)
createQueryGroupCRUD('accounts');
```

### 2. Inject Keys Early

Apply `inyectKeysToQueries` immediately after creation:

```typescript
// GOOD
let group = createQueryGroupCRUD<T>(entity);
group = inyectKeysToQueries(group, { auth: true });

// Then extend or export
export const entityQueryGroup = { ...group };
```

### 3. Keep Entity Names Consistent

Use plural, lowercase entity names that match your API:

```typescript
// GOOD
createQueryGroupCRUD('accounts');
createQueryGroupCRUD('transactions');

// AVOID
createQueryGroupCRUD('Account');
createQueryGroupCRUD('TransactionEntity');
```

### 4. Don't Modify Normalize Functions Directly

If you need custom normalization, do it in wrapper hooks:

```typescript
// GOOD - Custom normalization in wrapper hook
export const useAccountUpdate = ({ onSuccess, ...rest }) =>
  generatedAccountUpdate({
    mutation: {
      onSuccess: (data, variables, context) => {
        accountsQueryGroup.update.normalize?.(data);

        // Custom additional normalization
        queryClient.setQueryData([balanceQueryKey], (old) => ({
          ...old,
          total: data.balance,
        }));

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## See Also

- [Query Groups](../core-concepts/query-groups.md) - Understanding the QueryGroup pattern
- [Key Injection](../core-concepts/key-injection.md) - Adding metadata to query keys
- [Wrapper Hooks](../patterns/wrapper-hooks.md) - Integrating with KUBB-generated hooks
- [invalidateQueriesForKeys](./invalidateQueriesForKeys.md) - Batch invalidation helper
