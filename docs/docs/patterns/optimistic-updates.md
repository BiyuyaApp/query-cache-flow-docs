---
sidebar_position: 3
title: Optimistic Updates
description: Implement instant UI feedback with optimistic updates using Query Cache Flow's normalize functions
---

# Optimistic Updates

Optimistic updates provide instant UI feedback by updating the cache before the server responds. Query Cache Flow's `normalize` functions make this pattern straightforward and consistent.

## Why Optimistic Updates?

Without optimistic updates, users experience a delay between their action and seeing the result. With optimistic updates:

1. **Instant feedback** - UI updates immediately
2. **Better UX** - App feels more responsive
3. **Reduced perceived latency** - Users don't wait for server round-trips

## Built-in Normalize Functions

The `createQueryGroupCRUD` factory generates normalize functions for each operation:

```typescript
const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');

// Each operation has a normalize function:
// - create.normalize: Adds item to list, sets detail cache
// - update.normalize: Updates item in list and detail caches
// - remove.normalize: Removes item from list, clears detail cache
// - detail.normalize: Updates single item in list cache
```

## How Normalize Functions Work

### Create Operation

When creating a new item, `normalize` adds it to the list and sets the detail cache:

```typescript
create: {
  normalize: (data: { id: string }) => {
    // Add to list
    queryClient.setQueryData([list.queryKey], (old: any) => {
      if (!old) return [data];
      return [...old, data];
    });
    // Set detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], data);
  },
}
```

### Update Operation

When updating, `normalize` updates both the list and detail caches:

```typescript
update: {
  normalize: (data: { id: string }) => {
    // Update in list
    queryClient.setQueryData([list.queryKey], (old: any) => {
      if (!old) return old;
      return old.map((item: any) =>
        item.id === data.id ? data : item
      );
    });
    // Update detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], data);
  },
}
```

### Remove Operation

When deleting, `normalize` removes from the list and clears the detail:

```typescript
remove: {
  normalize: (data: { id: string }) => {
    // Remove from list
    queryClient.setQueryData([list.queryKey], (old: any) => {
      if (!old) return old;
      return old.filter((item: any) => item.id !== data.id);
    });
    // Clear detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], undefined);
  },
}
```

## Using Normalize in Mutations

Call the normalize function in your mutation's `onSuccess` handler:

```typescript
export const useAccountCreate = ({ onSuccess, ...rest }) =>
  generatedAccountCreate({
    mutation: {
      mutationKey: [accountsQueryGroup.create.queryKey],
      onSuccess: (data, variables, context) => {
        // Apply optimistic update
        accountsQueryGroup.create.normalize?.(data);

        // Also invalidate for server reconciliation
        invalidateQueriesForKeys([
          accountsQueryGroup.create.invalidates
        ]);

        // Call user's onSuccess
        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Full Optimistic Update Pattern

For true optimistic updates (before server response), use TanStack Query's `onMutate`:

```typescript
export const useAccountUpdate = ({ onSuccess, onError, ...rest }) =>
  generatedAccountUpdate({
    mutation: {
      mutationKey: [accountsQueryGroup.update.queryKey],

      // Optimistic update BEFORE server response
      onMutate: async (variables) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: [accountsQueryGroup.list.queryKey],
        });

        // Snapshot previous value for rollback
        const previousAccounts = queryClient.getQueryData([
          accountsQueryGroup.list.queryKey,
        ]);

        // Optimistically update to the new value
        queryClient.setQueryData(
          [accountsQueryGroup.list.queryKey],
          (old: Account[]) =>
            old?.map((account) =>
              account.id === variables.id
                ? { ...account, ...variables.data }
                : account
            )
        );

        // Return context for rollback
        return { previousAccounts };
      },

      // Rollback on error
      onError: (error, variables, context) => {
        queryClient.setQueryData(
          [accountsQueryGroup.list.queryKey],
          context?.previousAccounts
        );
        onError?.(error, variables, context);
      },

      // Sync with server on success
      onSuccess: (data, variables, context) => {
        accountsQueryGroup.update.normalize?.(data);
        onSuccess?.(data, variables, context);
      },

      // Always refetch after error or success
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: [accountsQueryGroup.list.queryKey],
        });
      },

      ...rest,
    },
  });
```

## Best Practices

### 1. Always Cancel In-Flight Queries

Before optimistic updates, cancel pending queries to prevent race conditions:

```typescript
import { cancelQueriesForKeys } from 'src/queries';

onMutate: async () => {
  cancelQueriesForKeys([
    accountsQueryGroup.list.queryKey,
    accountsQueryGroup.detail.queryKey(id),
  ]);
  // ...
}
```

### 2. Always Provide Rollback

Store the previous state and restore it on error:

```typescript
onMutate: async () => {
  const previous = queryClient.getQueryData([...queryKey]);
  return { previous };
},
onError: (error, variables, context) => {
  queryClient.setQueryData([...queryKey], context.previous);
}
```

### 3. Always Invalidate on Settled

Even with optimistic updates, invalidate to sync with server truth:

```typescript
onSettled: () => {
  invalidateQueriesForKeys([queryGroup.list.queryKey]);
}
```

### 4. Use Normalize for Simple Cases

For mutations where the server returns the updated data, `normalize` is often sufficient:

```typescript
onSuccess: (data) => {
  queryGroup.update.normalize?.(data);
}
```

## Real-World Example: Chat Messages

Here's a complete example with optimistic message sending:

```typescript
export const useMessageSend = ({ threadId, onSuccess, onError }) =>
  generatedMessageSend({
    mutation: {
      onMutate: async ({ data }) => {
        // Cancel refetches
        await queryClient.cancelQueries({
          queryKey: [threadsQueryGroup.detail.queryKey(threadId)],
        });

        // Snapshot
        const previousThread = queryClient.getQueryData([
          threadsQueryGroup.detail.queryKey(threadId),
        ]);

        // Optimistic update - add pending message
        queryClient.setQueryData(
          [threadsQueryGroup.detail.queryKey(threadId)],
          (old: Thread) => ({
            ...old,
            messages: [
              ...old.messages,
              {
                id: 'temp-' + Date.now(),
                content: data.content,
                status: 'pending',
                createdAt: new Date().toISOString(),
              },
            ],
          })
        );

        return { previousThread, threadId };
      },

      onError: (error, variables, context) => {
        // Rollback
        queryClient.setQueryData(
          [threadsQueryGroup.detail.queryKey(context.threadId)],
          context.previousThread
        );
        onError?.(error, variables, context);
      },

      onSuccess: (data, variables, context) => {
        // Replace temp message with real one
        queryClient.setQueryData(
          [threadsQueryGroup.detail.queryKey(context.threadId)],
          (old: Thread) => ({
            ...old,
            messages: old.messages.map((msg) =>
              msg.id.startsWith('temp-') ? data : msg
            ),
          })
        );
        onSuccess?.(data, variables, context);
      },
    },
  });
```

## Summary

| Approach | When to Use | Complexity |
|----------|-------------|------------|
| `normalize` only | Server returns updated data, simple updates | Low |
| `onMutate` + rollback | Need instant feedback, complex state | Medium |
| Full optimistic | Chat, real-time apps, offline support | High |

Query Cache Flow's built-in normalize functions handle most common cases. For complex scenarios, combine them with TanStack Query's full mutation lifecycle.
