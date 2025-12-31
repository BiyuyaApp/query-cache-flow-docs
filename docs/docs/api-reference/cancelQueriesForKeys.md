# cancelQueriesForKeys

A batch helper function that cancels in-flight queries for multiple TanStack Query cache keys. This is essential for preventing race conditions during optimistic updates.

## Type Signature

```typescript
export const cancelQueriesForKeys = (
  keys: Array<QueryKey<string>>,
): void
```

## Parameters

### `keys`

- **Type**: `Array<QueryKey<string>>`
- **Required**: Yes
- **Description**: Array of QueryKey objects for which to cancel in-flight queries

## Return Value

- **Type**: `void`
- **Description**: This function performs side effects (cancellation) and returns nothing

## How It Works

The function iterates through the provided array of QueryKeys and calls `queryClient.cancelQueries()` for each one. It automatically filters out any `null` or `undefined` values.

```typescript
export const cancelQueriesForKeys = (
  keys: Array<QueryKey<string>>,
): void => {
  keys.filter(Boolean).forEach((key) => {
    queryClient.cancelQueries({ queryKey: [key] });
  });
};
```

## Why Cancel Queries?

When performing optimistic updates, you must cancel any in-flight queries that might overwrite your optimistic data. This prevents race conditions where:

1. User triggers mutation
2. Mutation starts
3. Background refetch completes and overwrites optimistic update
4. Mutation completes but user sees stale data briefly

## Basic Example

```typescript
import { cancelQueriesForKeys } from 'src/queries';
import { accountsQueryGroup } from './queryGroups';

// Cancel in-flight account queries before optimistic update
await cancelQueriesForKeys([
  accountsQueryGroup.list.queryKey,
  accountsQueryGroup.detail.queryKey('account-123'),
]);
```

## Common Use Cases

### 1. Optimistic Updates (Most Important)

The primary use case is preventing race conditions during optimistic updates:

```typescript
export const useTransactionCreate = ({ onSuccess, ...rest }) =>
  generatedTransactionCreate({
    mutation: {
      mutationKey: [transactionsQueryGroup.create.queryKey],

      // Cancel queries BEFORE making optimistic changes
      onMutate: async (variables) => {
        // Cancel all queries that we're about to update
        await cancelQueriesForKeys([
          transactionsQueryGroup.list.queryKey,
          accountsQueryGroup.detail.queryKey(variables.data.accountId),
        ]);

        // Snapshot previous state for rollback
        const previousTransactions = queryClient.getQueryData([
          transactionsQueryGroup.list.queryKey,
        ]);

        // Perform optimistic update
        queryClient.setQueryData(
          [transactionsQueryGroup.list.queryKey],
          (old: any) => [...(old || []), variables.data]
        );

        return { previousTransactions };
      },

      // Rollback on error
      onError: (error, variables, context) => {
        if (context?.previousTransactions) {
          queryClient.setQueryData(
            [transactionsQueryGroup.list.queryKey],
            context.previousTransactions
          );
        }
      },

      // Refetch on success
      onSuccess: (data, variables, context) => {
        invalidateQueriesForKeys([
          transactionsQueryGroup.list.queryKey,
          accountsQueryGroup.detail.queryKey(data.accountId),
        ]);
      },

      ...rest,
    },
  });
```

### 2. Multi-Entity Optimistic Updates

When a mutation affects multiple entities:

```typescript
export const useAccountUpdate = ({ onSuccess, ...rest }) =>
  generatedAccountUpdate({
    mutation: {
      onMutate: async (variables) => {
        // Cancel all affected queries
        await cancelQueriesForKeys([
          accountsQueryGroup.list.queryKey,
          accountsQueryGroup.detail.queryKey(variables.id),
          balancesQueryGroup.list.queryKey,
          dashboardQueryGroup.summary.queryKey,
        ]);

        // Snapshot all affected caches
        const previousAccount = queryClient.getQueryData([
          accountsQueryGroup.detail.queryKey(variables.id),
        ]);
        const previousList = queryClient.getQueryData([
          accountsQueryGroup.list.queryKey,
        ]);

        // Optimistic updates...
        queryClient.setQueryData(
          [accountsQueryGroup.detail.queryKey(variables.id)],
          { ...previousAccount, ...variables.data }
        );

        return { previousAccount, previousList };
      },

      onError: (error, variables, context) => {
        // Rollback all caches
        if (context?.previousAccount) {
          queryClient.setQueryData(
            [accountsQueryGroup.detail.queryKey(variables.id)],
            context.previousAccount
          );
        }
        if (context?.previousList) {
          queryClient.setQueryData(
            [accountsQueryGroup.list.queryKey],
            context.previousList
          );
        }
      },

      ...rest,
    },
  });
```

### 3. Canceling During Navigation

Cancel in-flight queries when user navigates away:

```typescript
const handleNavigateAway = async () => {
  // Cancel any pending queries before unmounting
  await cancelQueriesForKeys([
    accountsQueryGroup.list.queryKey,
    transactionsQueryGroup.list.queryKey,
  ]);

  navigate('/dashboard');
};
```

## The Optimistic Update Pattern

Here's the complete pattern with cancellation:

```typescript
export const useItemUpdate = ({ onSuccess, ...rest }) =>
  generatedItemUpdate({
    mutation: {
      // 1. CANCEL - Prevent race conditions
      onMutate: async (variables) => {
        await cancelQueriesForKeys([
          itemsQueryGroup.list.queryKey,
          itemsQueryGroup.detail.queryKey(variables.id),
        ]);

        // 2. SNAPSHOT - Save previous state
        const previousItems = queryClient.getQueryData([
          itemsQueryGroup.list.queryKey,
        ]);

        // 3. OPTIMISTIC UPDATE - Update UI immediately
        queryClient.setQueryData(
          [itemsQueryGroup.list.queryKey],
          (old: any) =>
            old.map((item: any) =>
              item.id === variables.id ? { ...item, ...variables.data } : item
            )
        );

        return { previousItems };
      },

      // 4. ROLLBACK - Restore on error
      onError: (error, variables, context) => {
        if (context?.previousItems) {
          queryClient.setQueryData(
            [itemsQueryGroup.list.queryKey],
            context.previousItems
          );
        }
      },

      // 5. INVALIDATE - Fetch fresh data on success
      onSuccess: (data, variables, context) => {
        invalidateQueriesForKeys([
          itemsQueryGroup.list.queryKey,
          itemsQueryGroup.detail.queryKey(data.id),
        ]);
      },

      ...rest,
    },
  });
```

## Advanced Patterns

### Conditional Cancellation

Only cancel queries that might be affected:

```typescript
onMutate: async (variables) => {
  const keysToCancel = [itemsQueryGroup.list.queryKey];

  // Only cancel detail query if we're updating a specific item
  if (variables.id) {
    keysToCancel.push(itemsQueryGroup.detail.queryKey(variables.id));
  }

  // Only cancel related queries if relationship changed
  if (variables.data.categoryId) {
    keysToCancel.push(categoriesQueryGroup.list.queryKey);
  }

  await cancelQueriesForKeys(keysToCancel);

  // ...optimistic updates
};
```

### With TypeScript Context

Properly type your context for rollback:

```typescript
interface MutationContext {
  previousList: Transaction[] | undefined;
  previousDetail: Transaction | undefined;
  affectedAccountId: string;
}

export const useTransactionUpdate = ({ onSuccess, ...rest }) =>
  generatedTransactionUpdate({
    mutation: {
      onMutate: async (variables): Promise<MutationContext> => {
        await cancelQueriesForKeys([
          transactionsQueryGroup.list.queryKey,
          transactionsQueryGroup.detail.queryKey(variables.id),
        ]);

        const previousList = queryClient.getQueryData<Transaction[]>([
          transactionsQueryGroup.list.queryKey,
        ]);

        const previousDetail = queryClient.getQueryData<Transaction>([
          transactionsQueryGroup.detail.queryKey(variables.id),
        ]);

        // Optimistic updates...

        return {
          previousList,
          previousDetail,
          affectedAccountId: variables.data.accountId,
        };
      },

      onError: (error, variables, context?: MutationContext) => {
        if (context?.previousList) {
          queryClient.setQueryData(
            [transactionsQueryGroup.list.queryKey],
            context.previousList
          );
        }
        if (context?.previousDetail) {
          queryClient.setQueryData(
            [transactionsQueryGroup.detail.queryKey(variables.id)],
            context.previousDetail
          );
        }
      },

      ...rest,
    },
  });
```

## Comparison: With vs. Without Cancellation

### Without Cancellation (Race Condition Risk)

```typescript
// ❌ DANGEROUS - Race condition possible
onMutate: async (variables) => {
  // No cancellation!

  const previous = queryClient.getQueryData([itemsQueryGroup.list.queryKey]);

  queryClient.setQueryData([itemsQueryGroup.list.queryKey], (old) => [
    ...(old || []),
    variables.data,
  ]);

  return { previous };

  // If a background refetch completes here, it will overwrite our optimistic update!
};
```

### With Cancellation (Safe)

```typescript
// ✅ SAFE - Race condition prevented
onMutate: async (variables) => {
  // Cancel any in-flight queries first
  await cancelQueriesForKeys([itemsQueryGroup.list.queryKey]);

  const previous = queryClient.getQueryData([itemsQueryGroup.list.queryKey]);

  queryClient.setQueryData([itemsQueryGroup.list.queryKey], (old) => [
    ...(old || []),
    variables.data,
  ]);

  return { previous };

  // No background refetch can overwrite our changes
};
```

## When NOT to Use

### Simple Mutations Without Optimistic Updates

If you're just invalidating after success, cancellation isn't necessary:

```typescript
// No optimistic update = no need for cancellation
export const useSimpleUpdate = ({ onSuccess, ...rest }) =>
  generatedSimpleUpdate({
    mutation: {
      mutationKey: [itemsQueryGroup.update.queryKey],

      // Just invalidate on success
      onSuccess: (data, variables, context) => {
        invalidateQueriesForKeys([
          itemsQueryGroup.list.queryKey,
          itemsQueryGroup.detail.queryKey(data.id),
        ]);
      },

      ...rest,
    },
  });
```

## Performance Considerations

### Cancel Only What's Necessary

```typescript
// GOOD - Cancel only affected queries
await cancelQueriesForKeys([
  accountsQueryGroup.detail.queryKey(accountId),
]);

// AVOID - Don't cancel unrelated queries
await cancelQueriesForKeys([
  accountsQueryGroup.all.queryKey, // Too broad!
]);
```

### Async/Await is Required

Always `await` the cancellation:

```typescript
// GOOD
onMutate: async (variables) => {
  await cancelQueriesForKeys([...]);
  // Now safe to update
};

// BAD - Race condition still possible
onMutate: async (variables) => {
  cancelQueriesForKeys([...]); // Not awaited!
  // Updates might happen before cancellation completes
};
```

## Best Practices

### 1. Always Cancel Before Optimistic Updates

```typescript
onMutate: async (variables) => {
  // 1. Cancel first
  await cancelQueriesForKeys([...]);

  // 2. Then update
  queryClient.setQueryData([...], ...);
};
```

### 2. Cancel All Affected Queries

Think about what queries your mutation affects:

```typescript
// Account update affects multiple entities
await cancelQueriesForKeys([
  accountsQueryGroup.detail.queryKey(id),
  accountsQueryGroup.list.queryKey,
  balancesQueryGroup.list.queryKey,     // Balance depends on account
  dashboardQueryGroup.summary.queryKey, // Summary includes account data
]);
```

### 3. Use with invalidateQueriesForKeys

Combine both helpers for complete optimistic update flow:

```typescript
import { cancelQueriesForKeys, invalidateQueriesForKeys } from 'src/queries';

// onMutate: cancel
await cancelQueriesForKeys([...]);

// onSuccess: invalidate
invalidateQueriesForKeys([...]);
```

## See Also

- [invalidateQueriesForKeys](./invalidateQueriesForKeys.md) - Batch invalidation helper
- [Optimistic Updates](../patterns/optimistic-updates.md) - Complete optimistic update pattern
- [Wrapper Hooks](../patterns/wrapper-hooks.md) - Integrating cancellation into hooks
- [TanStack Query Docs - Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
