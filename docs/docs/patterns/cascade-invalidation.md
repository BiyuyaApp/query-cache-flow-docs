# Cascade Invalidation Pattern

When deleting or updating an entity that has relationships with other entities, you need to invalidate not just the entity itself, but all related queries. This is cascade invalidation.

## The Problem

In complex applications, entities are interconnected:

- **Deleting an account** affects transactions, balances, movements, recurrences, and reminders
- **Updating a transaction** affects account balances and movement aggregations
- **Changing a user's role** affects permissions, dashboards, and accessible resources

Manual invalidation is error-prone:

```typescript
// Easy to forget related queries
queryClient.invalidateQueries({ queryKey: [accountsQueryGroup.detail.queryKey(id)] });
queryClient.invalidateQueries({ queryKey: [accountsQueryGroup.list.queryKey] });
// Forgot transactions! Forgot balances! Stale data everywhere!
```

## The Solution

Define cascade invalidation logic in query group definitions, then use `invalidateQueriesForKeys` to execute them:

```typescript
export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,
  remove: {
    ...accountsQueryGroupCRUD.remove,
    invalidates: (id: Account['id']) => [
      // Base invalidations (from CRUD factory)
      ...accountsQueryGroupCRUD.remove.invalidates(id),

      // Cascade to related entities
      transactionsQueryGroup.all.queryKey,
      recurrencesQueryGroup.all.queryKey,
      transferencesQueryGroup.all.queryKey,
      movementsQueryGroup.all.queryKey,
      remindersQueryGroup.all.queryKey,
    ],
  },
};
```

## Real-World Example: Account Deletion

From a production application managing financial data:

### Query Group Definition

```typescript
import { movementsQueryGroup } from 'src/features/movements/queries';
import { recurrencesQueryGroup } from 'src/features/recurrences/queries';
import { remindersQueryGroup } from 'src/features/reminders/queries';
import { transactionsQueryGroup } from 'src/features/transactions/queries';
import { transferencesQueryGroup } from 'src/features/transferences/queries';
import { Account } from 'src/generated';
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';

// Create base CRUD operations
let accountsQueryGroupCRUD = createQueryGroupCRUD<Account['id']>('accounts');
accountsQueryGroupCRUD = inyectKeysToQueries(accountsQueryGroupCRUD, { auth: true });

export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,

  // Override remove with cascade invalidations
  remove: {
    ...accountsQueryGroupCRUD.remove,
    invalidates: (id: Account['id']) => [
      // Base: invalidate the account itself and account list
      ...accountsQueryGroupCRUD.remove.invalidates(id),

      // Cascade: all transactions belong to accounts
      transactionsQueryGroup.all.queryKey,

      // Cascade: recurrences are tied to accounts
      recurrencesQueryGroup.all.queryKey,

      // Cascade: transfers involve accounts
      transferencesQueryGroup.all.queryKey,

      // Cascade: movements aggregate account data
      movementsQueryGroup.all.queryKey,

      // Cascade: reminders are account-specific
      remindersQueryGroup.all.queryKey,
    ],
  },
};
```

### Wrapper Hook

```typescript
import { invalidateQueriesForKeys } from 'src/queries';
import { accountsQueryGroup } from './index';

export const useAccountDelete = ({ onSuccess, ...rest }) =>
  generatedAccountDelete({
    mutation: {
      mutationKey: [accountsQueryGroup.remove.queryKey],
      onSuccess: (data, variables, context) => {
        // Normalize (remove from cache)
        accountsQueryGroup.remove.normalize?.(data);

        // Cascade invalidation - one line handles everything
        invalidateQueriesForKeys(accountsQueryGroup.remove.invalidates(variables.id));

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Determining What to Invalidate

### 1. Direct Relationships

Invalidate queries for entities that directly reference the deleted entity:

```typescript
// Transaction belongs to Account
// -> Delete Account invalidates Transactions
remove: {
  invalidates: (id) => [
    ...baseInvalidates,
    transactionsQueryGroup.all.queryKey,
  ],
}
```

### 2. Aggregations and Computed Data

Invalidate queries that aggregate or compute from the entity:

```typescript
// Balances are computed from Accounts
// -> Delete Account invalidates Balances
remove: {
  invalidates: (id) => [
    ...baseInvalidates,
    balancesQueryGroup.list.queryKey,
    dashboardQueryGroup.summary.queryKey,
  ],
}
```

### 3. Many-to-Many Relationships

Invalidate both sides of a many-to-many relationship:

```typescript
// User has many Projects, Project has many Users
// -> Remove User from Project invalidates both
removeUserFromProject: {
  invalidates: (projectId, userId) => [
    projectsQueryGroup.detail.queryKey(projectId),
    projectsQueryGroup.list.queryKey,
    usersQueryGroup.detail.queryKey(userId),
    usersQueryGroup.list.queryKey,
  ],
}
```

### 4. Nested Resources

Invalidate parent and child resources:

```typescript
// Comments belong to Posts belong to Users
// -> Delete Post invalidates Comments and User's post list
remove: {
  invalidates: (postId) => [
    ...baseInvalidates,
    commentsQueryGroup.all.queryKey,           // Child
    usersQueryGroup.posts.queryKey(userId),   // Parent collection
  ],
}
```

## Patterns by Mutation Type

### Create: Selective Invalidation

Creating usually affects fewer queries:

```typescript
create: {
  queryKey: { entity: 'transactions', method: 'create' },
  invalidates: [
    { entity: 'transactions', method: 'list' },  // New item appears in list
    accountsQueryGroup.list.queryKey,            // Account balance changes
    balancesQueryGroup.summary.queryKey,         // Summary includes new transaction
  ],
}
```

### Update: Targeted Invalidation

Updates typically affect the entity, its list, and related aggregations:

```typescript
update: {
  queryKey: (id) => ({ entity: 'transactions', method: 'update', id }),
  invalidates: (id) => [
    { entity: 'transactions', id },              // The transaction itself
    { entity: 'transactions', method: 'list' },  // List includes this transaction
    accountsQueryGroup.list.queryKey,            // Account balance might change
    balancesQueryGroup.summary.queryKey,         // Summary might change
  ],
}
```

### Delete: Broad Invalidation

Deletes often require the most extensive invalidation:

```typescript
remove: {
  queryKey: (id) => ({ entity: 'accounts', method: 'remove', id }),
  invalidates: (id) => [
    { entity: 'accounts', id },                  // The account itself
    { entity: 'accounts', method: 'list' },      // Account list
    transactionsQueryGroup.all.queryKey,         // All transactions
    recurrencesQueryGroup.all.queryKey,          // All recurrences
    transferencesQueryGroup.all.queryKey,        // All transfers
    movementsQueryGroup.all.queryKey,            // All movements
    remindersQueryGroup.all.queryKey,            // All reminders
    balancesQueryGroup.list.queryKey,            // Balance summary
    dashboardQueryGroup.summary.queryKey,        // Dashboard stats
  ],
}
```

## Granular vs. Broad Invalidation

### Use `.all` for Broad Invalidation

When an entity is deleted, often safest to invalidate all related queries:

```typescript
// Broad: invalidate ALL transactions (safe but might refetch more than needed)
transactionsQueryGroup.all.queryKey

// Equivalent to: { entity: 'transactions' }
// Matches: { entity: 'transactions', method: 'list' }
//          { entity: 'transactions', method: 'detail', id: '123' }
//          { entity: 'transactions', method: 'create' }
//          etc.
```

### Use `.list` for Targeted Invalidation

When only the list needs refreshing:

```typescript
// Targeted: only invalidate the list query
transactionsQueryGroup.list.queryKey

// Matches only: { entity: 'transactions', method: 'list' }
```

### Use `.detail()` for Specific Invalidation

When you know the specific resource:

```typescript
// Specific: only invalidate this one transaction
transactionsQueryGroup.detail.queryKey(transactionId)

// Matches only: { entity: 'transactions', method: 'detail', id: transactionId }
```

## Conditional Cascade Invalidation

Sometimes you need to invalidate different queries based on the mutation's data:

```typescript
export const useTransactionUpdate = ({ onSuccess, ...rest }) =>
  generatedTransactionUpdate({
    mutation: {
      onSuccess: (data, variables, context) => {
        transactionsQueryGroup.update.normalize?.(data);

        const keysToInvalidate = transactionsQueryGroup.update.invalidates(data.id);

        // Conditional: only invalidate account if it changed
        if (data.accountId !== variables.previousAccountId) {
          keysToInvalidate.push(
            accountsQueryGroup.detail.queryKey(data.accountId),
            accountsQueryGroup.detail.queryKey(variables.previousAccountId)
          );
        }

        // Conditional: only invalidate category if it changed
        if (data.categoryId !== variables.previousCategoryId) {
          keysToInvalidate.push(categoriesQueryGroup.list.queryKey);
        }

        invalidateQueriesForKeys(keysToInvalidate);

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Backend-Driven Invalidation

Some APIs return which entities were affected:

```typescript
interface MutationResponse {
  data: Transaction;
  affectedEntities: string[]; // ['accounts', 'balances', 'movements']
}

// Map entity names to query keys
export const ENTITY_TO_QUERY_KEY_MAP: Record<string, QueryKey<any>> = {
  accounts: accountsQueryGroup.list.queryKey,
  transactions: transactionsQueryGroup.list.queryKey,
  balances: balancesQueryGroup.list.queryKey,
  movements: movementsQueryGroup.list.queryKey,
  recurrences: recurrencesQueryGroup.list.queryKey,
};

export function getQueryKeysFromAffectedEntities(affectedEntities: string[]) {
  return affectedEntities
    .map((entity) => ENTITY_TO_QUERY_KEY_MAP[entity])
    .filter(Boolean);
}

// Use in wrapper hook
export const useComplexMutation = ({ onSuccess, ...rest }) =>
  generatedComplexMutation({
    mutation: {
      onSuccess: (response: MutationResponse, variables, context) => {
        // Base invalidations
        const keysToInvalidate = baseQueryGroup.update.invalidates(response.data.id);

        // Add backend-provided invalidations
        const backendKeys = getQueryKeysFromAffectedEntities(response.affectedEntities);
        keysToInvalidate.push(...backendKeys);

        invalidateQueriesForKeys(keysToInvalidate);

        onSuccess?.(response, variables, context);
      },
      ...rest,
    },
  });
```

## Avoiding Over-Invalidation

### Don't Invalidate Unrelated Queries

```typescript
// BAD - Invalidates everything
remove: {
  invalidates: (id) => [
    accountsQueryGroup.all.queryKey,
    transactionsQueryGroup.all.queryKey,
    categoriesQueryGroup.all.queryKey,  // Categories are unrelated!
    usersQueryGroup.all.queryKey,       // Users are unrelated!
  ],
}

// GOOD - Only invalidate related queries
remove: {
  invalidates: (id) => [
    accountsQueryGroup.all.queryKey,
    transactionsQueryGroup.all.queryKey,  // Transactions belong to accounts
  ],
}
```

### Use Granular Keys When Possible

```typescript
// Less efficient - invalidates all transactions
invalidateQueriesForKeys([transactionsQueryGroup.all.queryKey]);

// More efficient - only invalidates transactions for this account
invalidateQueriesForKeys([
  {
    entity: 'transactions',
    method: 'list',
    accountId: deletedAccountId,
  },
]);
```

## Documentation Pattern

Document why each query is invalidated:

```typescript
export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,
  remove: {
    ...accountsQueryGroupCRUD.remove,
    invalidates: (id: Account['id']) => [
      ...accountsQueryGroupCRUD.remove.invalidates(id),

      // Transactions: All transactions belong to accounts
      transactionsQueryGroup.all.queryKey,

      // Recurrences: Recurrences are tied to account budgets
      recurrencesQueryGroup.all.queryKey,

      // Transfers: Transfers involve source/destination accounts
      transferencesQueryGroup.all.queryKey,

      // Movements: Movements aggregate transaction data by account
      movementsQueryGroup.all.queryKey,

      // Reminders: Reminders are account-specific notifications
      remindersQueryGroup.all.queryKey,
    ],
  },
};
```

## Testing Cascade Invalidation

### Manual Testing Checklist

After implementing cascade invalidation:

1. **Delete an account**
2. **Verify all related lists refresh**:
   - Account list shows account removed ✓
   - Transaction list no longer shows account's transactions ✓
   - Balance summary recalculates ✓
   - Dashboard stats update ✓
3. **Check for stale data**: Navigate through the app, no old data should appear

### Automated Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { queryClient } from 'src/queries/client';
import { useAccountDelete, useTransactions, useBalances } from './hooks';

test('deleting account invalidates related queries', async () => {
  const { result: deleteResult } = renderHook(() => useAccountDelete());
  const { result: transactionsResult } = renderHook(() => useTransactions());
  const { result: balancesResult } = renderHook(() => useBalances());

  // Pre-populate caches
  await waitFor(() => {
    expect(transactionsResult.current.data).toBeDefined();
    expect(balancesResult.current.data).toBeDefined();
  });

  // Spy on invalidateQueries
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

  // Delete account
  deleteResult.current.mutate({ id: 'account-123' });

  await waitFor(() => {
    expect(deleteResult.current.isSuccess).toBe(true);
  });

  // Verify invalidations were called
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: [expect.objectContaining({ entity: 'transactions' })],
  });
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: [expect.objectContaining({ entity: 'balances' })],
  });
});
```

## Best Practices

### 1. Define Invalidations in Query Groups

```typescript
// GOOD - Centralized logic
export const accountsQueryGroup = {
  remove: {
    invalidates: (id) => [...allRelatedQueries],
  },
};

// AVOID - Scattered logic
// (in multiple wrapper hooks, each might forget some invalidations)
```

### 2. Use Spread for Base Invalidations

Always include base invalidations from the CRUD factory:

```typescript
// GOOD
invalidates: (id) => [
  ...accountsQueryGroupCRUD.remove.invalidates(id),
  ...customInvalidations,
]

// BAD - Forgot base invalidations!
invalidates: (id) => [
  ...customInvalidations,
]
```

### 3. Invalidate Broader Rather Than Miss

When in doubt, invalidate more:

```typescript
// GOOD - Safe, might refetch a bit extra
transactionsQueryGroup.all.queryKey

// RISKY - Might miss some transaction queries
transactionsQueryGroup.list.queryKey
```

### 4. Comment Relationships

```typescript
invalidates: (id) => [
  ...baseInvalidates,
  transactionsQueryGroup.all.queryKey,  // Transactions belong to accounts
  balancesQueryGroup.list.queryKey,     // Balances computed from accounts
]
```

## See Also

- [invalidateQueriesForKeys](../api-reference/invalidateQueriesForKeys.md) - Batch invalidation helper
- [Query Groups](../core-concepts/query-groups.md) - Understanding query group structure
- [Wrapper Hooks](./wrapper-hooks.md) - Integrating invalidation into hooks
- [Entity Mapping](./entity-mapping.md) - Backend-driven invalidation pattern
