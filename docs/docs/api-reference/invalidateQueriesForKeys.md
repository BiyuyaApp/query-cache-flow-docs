# invalidateQueriesForKeys

A batch helper function that invalidates multiple TanStack Query cache entries based on an array of QueryKeys.

## Type Signature

```typescript
export const invalidateQueriesForKeys = (
  keys: Array<QueryKey<string>>,
  invalidateOptions?: InvalidateQueryFilters,
): void
```

## Parameters

### `keys`

- **Type**: `Array<QueryKey<string>>`
- **Required**: Yes
- **Description**: Array of QueryKey objects to invalidate

### `invalidateOptions`

- **Type**: `InvalidateQueryFilters` (from `@tanstack/react-query`)
- **Required**: No
- **Description**: Additional options passed to `queryClient.invalidateQueries()`

## Return Value

- **Type**: `void`
- **Description**: This function performs side effects (invalidation) and returns nothing

## How It Works

The function iterates through the provided array of QueryKeys and calls `queryClient.invalidateQueries()` for each one. It automatically filters out any `null` or `undefined` values.

```typescript
export const invalidateQueriesForKeys = (
  keys: Array<QueryKey<string>>,
  invalidateOptions?: InvalidateQueryFilters,
): void => {
  keys.filter(Boolean).forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key], ...invalidateOptions });
  });
};
```

## Basic Example

```typescript
import { invalidateQueriesForKeys } from 'src/queries';
import { accountsQueryGroup, transactionsQueryGroup } from './queryGroups';

// Invalidate multiple related queries at once
invalidateQueriesForKeys([
  accountsQueryGroup.list.queryKey,
  transactionsQueryGroup.list.queryKey,
]);
```

## Common Use Cases

### 1. Cascade Invalidation

When deleting an account, invalidate all related entities:

```typescript
export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,
  remove: {
    ...accountsQueryGroupCRUD.remove,
    invalidates: (id: Account['id']) => [
      ...accountsQueryGroupCRUD.remove.invalidates(id),
      transactionsQueryGroup.all.queryKey,
      recurrencesQueryGroup.all.queryKey,
      transferencesQueryGroup.all.queryKey,
      movementsQueryGroup.all.queryKey,
      remindersQueryGroup.all.queryKey,
    ],
  },
};

// In wrapper hook
export const useAccountDelete = ({ onSuccess, ...rest }) =>
  generatedAccountDelete({
    mutation: {
      mutationKey: [accountsQueryGroup.remove.queryKey],
      onSuccess: (data, variables, context) => {
        const invalidationKeys = accountsQueryGroup.remove.invalidates(variables.id);

        // Invalidate all related queries at once
        invalidateQueriesForKeys(invalidationKeys);

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

### 2. Manual Multi-Query Invalidation

```typescript
// After a bulk operation
const handleBulkUpdate = async () => {
  await bulkUpdateAccounts(selectedIds);

  // Invalidate multiple query groups
  invalidateQueriesForKeys([
    accountsQueryGroup.list.queryKey,
    accountsQueryGroup.all.queryKey,
    balancesQueryGroup.list.queryKey,
    dashboardQueryGroup.summary.queryKey,
  ]);
};
```

### 3. With Invalidation Options

```typescript
import { invalidateQueriesForKeys } from 'src/queries';

// Only refetch queries that are currently being observed
invalidateQueriesForKeys(
  [
    accountsQueryGroup.list.queryKey,
    transactionsQueryGroup.list.queryKey,
  ],
  {
    refetchType: 'active',
  }
);

// Invalidate without refetching
invalidateQueriesForKeys(
  [
    accountsQueryGroup.list.queryKey,
  ],
  {
    refetchType: 'none',
  }
);
```

## Integration with Query Groups

The function is designed to work with the `invalidates` property of query groups:

```typescript
// Define cascade invalidation in query group
export const transactionQueryGroup = {
  ...createQueryGroupCRUD<Transaction['id']>('transactions'),
  create: {
    ...transactionsQueryGroupCRUD.create,
    invalidates: [
      transactionsQueryGroupCRUD.create.invalidates,
      accountsQueryGroup.list.queryKey,
      balancesQueryGroup.list.queryKey,
    ],
  },
};

// Use in wrapper hook
export const useTransactionCreate = ({ onSuccess, ...rest }) =>
  generatedTransactionCreate({
    mutation: {
      mutationKey: [transactionQueryGroup.create.queryKey],
      onSuccess: (data, variables, context) => {
        transactionQueryGroup.create.normalize?.(data);

        // Invalidate all related queries
        invalidateQueriesForKeys(transactionQueryGroup.create.invalidates);

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Comparison with Direct invalidateQueries

### Without `invalidateQueriesForKeys`

```typescript
// Manual, verbose approach
queryClient.invalidateQueries({ queryKey: [accountsQueryGroup.list.queryKey] });
queryClient.invalidateQueries({ queryKey: [transactionsQueryGroup.list.queryKey] });
queryClient.invalidateQueries({ queryKey: [movementsQueryGroup.list.queryKey] });
```

### With `invalidateQueriesForKeys`

```typescript
// Clean, declarative approach
invalidateQueriesForKeys([
  accountsQueryGroup.list.queryKey,
  transactionsQueryGroup.list.queryKey,
  movementsQueryGroup.list.queryKey,
]);
```

## Advanced Patterns

### Dynamic Invalidation Based on Response

```typescript
export const useAccountUpdate = ({ onSuccess, ...rest }) =>
  generatedAccountUpdate({
    mutation: {
      onSuccess: (data, variables, context) => {
        // Base invalidations
        const keysToInvalidate = accountsQueryGroup.update.invalidates(data.id);

        // Add conditional invalidations based on response
        if (data.balanceChanged) {
          keysToInvalidate.push(balancesQueryGroup.list.queryKey);
        }

        if (data.statusChanged) {
          keysToInvalidate.push(dashboardQueryGroup.stats.queryKey);
        }

        invalidateQueriesForKeys(keysToInvalidate);

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

### Backend-Driven Invalidation

When your backend tells you which entities were affected:

```typescript
// Backend response includes affected entities
interface MutationResponse {
  data: Transaction;
  affectedEntities: string[]; // ['accounts', 'balances', 'movements']
}

// Map entity names to query keys
const ENTITY_TO_QUERY_KEY_MAP: Record<string, QueryKey<any>> = {
  accounts: accountsQueryGroup.list.queryKey,
  transactions: transactionsQueryGroup.list.queryKey,
  balances: balancesQueryGroup.list.queryKey,
  movements: movementsQueryGroup.list.queryKey,
};

export const useComplexMutation = ({ onSuccess, ...rest }) =>
  generatedComplexMutation({
    mutation: {
      onSuccess: (response: MutationResponse, variables, context) => {
        // Extract query keys from backend response
        const keysToInvalidate = response.affectedEntities
          .map((entity) => ENTITY_TO_QUERY_KEY_MAP[entity])
          .filter(Boolean);

        invalidateQueriesForKeys(keysToInvalidate);

        onSuccess?.(response, variables, context);
      },
      ...rest,
    },
  });
```

## Error Handling

The function filters out falsy values, so you can safely include conditional keys:

```typescript
invalidateQueriesForKeys([
  accountsQueryGroup.list.queryKey,
  shouldInvalidateTransactions ? transactionsQueryGroup.list.queryKey : null,
  isAdmin ? adminQueryGroup.dashboard.queryKey : null,
]);

// Falsy values are automatically filtered out
```

## Performance Considerations

### Batch Invalidations

Invalidating multiple queries at once is more efficient than calling invalidation separately:

```typescript
// GOOD - Single function call
invalidateQueriesForKeys([key1, key2, key3]);

// LESS EFFICIENT - Multiple function calls
queryClient.invalidateQueries({ queryKey: [key1] });
queryClient.invalidateQueries({ queryKey: [key2] });
queryClient.invalidateQueries({ queryKey: [key3] });
```

### Granular vs. Broad Invalidation

```typescript
// Granular: Only invalidate specific resource
invalidateQueriesForKeys([
  accountsQueryGroup.detail.queryKey(accountId),
]);

// Broad: Invalidate all accounts
invalidateQueriesForKeys([
  accountsQueryGroup.all.queryKey,
]);

// Choose based on mutation impact
```

## Best Practices

### 1. Use with Query Group invalidates

Define invalidation logic in query groups, execute in hooks:

```typescript
// In query group definition
export const accountsQueryGroup = {
  remove: {
    invalidates: (id) => [
      { entity: 'accounts', id },
      { entity: 'accounts', method: 'list' },
      transactionsQueryGroup.all.queryKey,
    ],
  },
};

// In wrapper hook
invalidateQueriesForKeys(accountsQueryGroup.remove.invalidates(id));
```

### 2. Combine with Normalize

Use optimistic updates first, then invalidate for fresh data:

```typescript
onSuccess: (data, variables, context) => {
  // 1. Optimistic update
  queryGroup.update.normalize?.(data);

  // 2. Invalidate to fetch fresh data
  invalidateQueriesForKeys(queryGroup.update.invalidates(data.id));
};
```

### 3. Document Cascading Invalidations

When invalidating multiple entities, add comments explaining why:

```typescript
export const accountsQueryGroup = {
  remove: {
    invalidates: (id: Account['id']) => [
      ...accountsQueryGroupCRUD.remove.invalidates(id),
      transactionsQueryGroup.all.queryKey,  // Transactions belong to accounts
      movementsQueryGroup.all.queryKey,     // Movements aggregate transactions
      balancesQueryGroup.list.queryKey,     // Balances depend on accounts
    ],
  },
};
```

## See Also

- [cancelQueriesForKeys](./cancelQueriesForKeys.md) - Cancel in-flight queries
- [createQueryGroupCRUD](./createQueryGroupCRUD.md) - Generate query groups with invalidation logic
- [Cascade Invalidation](../patterns/cascade-invalidation.md) - Pattern for multi-entity invalidation
- [Wrapper Hooks](../patterns/wrapper-hooks.md) - Integrating invalidation into hooks
