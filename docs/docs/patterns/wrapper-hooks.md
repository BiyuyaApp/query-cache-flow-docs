# Wrapper Hooks Pattern

The wrapper hooks pattern is the bridge between KUBB-generated hooks and CACHE-FLOW's query key management system. It enables type-safe, automatically invalidating queries with zero cognitive overhead.

## The Problem

KUBB generates React Query hooks from your OpenAPI spec, but these generated hooks:

1. **Don't include cache keys** - You must provide your own
2. **Don't handle invalidation** - Manual invalidation after mutations
3. **Don't support optimistic updates** - No built-in normalization
4. **Require boilerplate** - Repetitive setup for each hook

## The Solution

Wrap KUBB-generated hooks with thin wrappers that inject CACHE-FLOW query keys and invalidation logic:

```typescript
// KUBB generates this (don't modify)
import { useAccounts as generatedUseAccounts } from 'src/generated';

// You create this wrapper
export const useAccounts = () =>
  generatedUseAccounts({
    query: { queryKey: [accountsQueryGroup.list.queryKey] },
  });
```

## Basic Query Wrapper

### Simple List Query

```typescript
import { accountsQueryGroup } from './queryGroups';
import { useAccounts as generatedUseAccounts } from 'src/generated';

export const useAccounts = () =>
  generatedUseAccounts({
    query: { queryKey: [accountsQueryGroup.list.queryKey] },
  });
```

**Usage:**
```typescript
function AccountsList() {
  const { data: accounts, isLoading } = useAccounts();

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {accounts?.map(account => (
        <li key={account.id}>{account.name}</li>
      ))}
    </ul>
  );
}
```

### Detail Query with ID

```typescript
import { accountsQueryGroup } from './queryGroups';
import { useAccount as generatedUseAccount } from 'src/generated';

export const useAccount = (id: string) =>
  generatedUseAccount(id, {
    query: { queryKey: [accountsQueryGroup.detail.queryKey(id)] },
  });
```

**Usage:**
```typescript
function AccountDetail({ accountId }: { accountId: string }) {
  const { data: account, isLoading } = useAccount(accountId);

  if (isLoading) return <div>Loading...</div>;

  return <div>{account?.name}</div>;
}
```

## Mutation Wrappers

### Create Mutation with Invalidation

```typescript
import { UseMutationOptions } from '@tanstack/react-query';
import { accountsQueryGroup } from './queryGroups';
import {
  AccountCreate400,
  AccountCreate401,
  AccountCreate403,
  AccountCreateMutationRequest,
  AccountCreateMutationResponse,
  useAccountCreate as generatedAccountCreate,
} from 'src/generated';
import queryClient from 'src/queries/client';
import { ResponseErrorConfig } from 'src/services/axios';

type AccountCreateProps = UseMutationOptions<
  AccountCreateMutationResponse,
  ResponseErrorConfig<AccountCreate400 | AccountCreate401 | AccountCreate403>,
  { data: AccountCreateMutationRequest }
>;

export const useAccountCreate = ({ onSuccess, ...rest }: AccountCreateProps = {}) =>
  generatedAccountCreate({
    mutation: {
      mutationKey: [accountsQueryGroup.create.queryKey],
      onSuccess: (data, variables, context) => {
        // 1. Optimistic update (optional)
        accountsQueryGroup.create.normalize?.(data);

        // 2. Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: [accountsQueryGroup.create.invalidates],
        });

        // 3. Call user-provided onSuccess
        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

**Usage:**
```typescript
function CreateAccountForm() {
  const createAccount = useAccountCreate({
    onSuccess: (newAccount) => {
      toast.success(`Account ${newAccount.name} created!`);
      navigate(`/accounts/${newAccount.id}`);
    },
  });

  const handleSubmit = (formData) => {
    createAccount.mutate({ data: formData });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Update Mutation

```typescript
type AccountUpdateProps = UseMutationOptions<
  AccountUpdateMutationResponse,
  ResponseErrorConfig<AccountUpdate400 | AccountUpdate401 | AccountUpdate403>,
  { id: string; data: AccountUpdateMutationRequest }
>;

export const useAccountUpdate = ({ onSuccess, ...rest }: AccountUpdateProps = {}) =>
  generatedAccountUpdate({
    mutation: {
      mutationKey: [accountsQueryGroup.update.queryKey],
      onSuccess: (data, variables, context) => {
        // Normalize cache
        accountsQueryGroup.update.normalize?.(data);

        // Invalidate affected queries
        invalidateQueriesForKeys(accountsQueryGroup.update.invalidates(data.id));

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

### Delete Mutation with Cascade Invalidation

```typescript
type AccountDeleteProps = UseMutationOptions<
  AccountDeleteMutationResponse,
  ResponseErrorConfig<AccountDelete400 | AccountDelete401 | AccountDelete403>,
  { id: string }
>;

export const useAccountDelete = ({ onSuccess, ...rest }: AccountDeleteProps = {}) =>
  generatedAccountDelete({
    mutation: {
      mutationKey: [accountsQueryGroup.remove.queryKey],
      onSuccess: (data, variables, context) => {
        // Normalize (remove from cache)
        accountsQueryGroup.remove.normalize?.(data);

        // Cascade invalidation to all related entities
        invalidateQueriesForKeys(accountsQueryGroup.remove.invalidates(variables.id));

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Advanced Patterns

### Wrapper with Query Parameters

For queries that accept filters or pagination:

```typescript
import { RemindersQueryParams } from './types';

export const useReminders = (queryParams?: RemindersQueryParams) =>
  generatedUseReminders(queryParams, {
    query: {
      queryKey: [remindersQueryGroup.list.queryKey(queryParams)],
    },
  });
```

**Usage:**
```typescript
function RemindersList() {
  const { data: activeReminders } = useReminders({ status: 'active' });
  const { data: completedReminders } = useReminders({ status: 'completed' });

  // Each query has its own cache entry based on params
}
```

### Wrapper with Custom Options

Allow users to override query options:

```typescript
import { UseQueryOptions } from '@tanstack/react-query';

type UseAccountsOptions = Partial<UseQueryOptions<Account[]>>;

export const useAccounts = (options?: UseAccountsOptions) =>
  generatedUseAccounts({
    query: {
      queryKey: [accountsQueryGroup.list.queryKey],
      staleTime: 1000 * 60 * 5, // 5 minutes
      ...options,
    },
  });
```

**Usage:**
```typescript
function AccountsList() {
  const { data } = useAccounts({
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // Override to 10 minutes
  });
}
```

### Mutation with Optimistic Updates

```typescript
export const useTransactionCreate = ({ onSuccess, ...rest }: TransactionCreateProps = {}) =>
  generatedTransactionCreate({
    mutation: {
      mutationKey: [transactionsQueryGroup.create.queryKey],

      // Cancel in-flight queries
      onMutate: async (variables) => {
        await cancelQueriesForKeys([
          transactionsQueryGroup.list.queryKey,
          accountsQueryGroup.detail.queryKey(variables.data.accountId),
        ]);

        const previousTransactions = queryClient.getQueryData([
          transactionsQueryGroup.list.queryKey,
        ]);

        // Optimistic update
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
        transactionsQueryGroup.create.normalize?.(data);
        invalidateQueriesForKeys([
          transactionsQueryGroup.list.queryKey,
          accountsQueryGroup.detail.queryKey(data.accountId),
        ]);
        onSuccess?.(data, variables, context);
      },

      ...rest,
    },
  });
```

### Conditional Invalidation

Invalidate different queries based on mutation result:

```typescript
export const useAccountUpdate = ({ onSuccess, ...rest }: AccountUpdateProps = {}) =>
  generatedAccountUpdate({
    mutation: {
      onSuccess: (data, variables, context) => {
        accountsQueryGroup.update.normalize?.(data);

        const keysToInvalidate = accountsQueryGroup.update.invalidates(data.id);

        // Conditional invalidations
        if (data.balanceChanged) {
          keysToInvalidate.push(balancesQueryGroup.list.queryKey);
        }

        if (data.currencyChanged) {
          keysToInvalidate.push(exchangeRatesQueryGroup.list.queryKey);
        }

        invalidateQueriesForKeys(keysToInvalidate);

        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## File Organization

Organize wrapper hooks alongside query group definitions:

```
src/features/accounts/queries/
├── index.ts                 # Export query group
├── useAccounts.ts          # List wrapper
├── useAccount.ts           # Detail wrapper
├── useAccountCreate.ts     # Create wrapper
├── useAccountUpdate.ts     # Update wrapper
└── useAccountDelete.ts     # Delete wrapper
```

**index.ts:**
```typescript
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';

let accountsQueryGroupCRUD = createQueryGroupCRUD<Account['id']>('accounts');
accountsQueryGroupCRUD = inyectKeysToQueries(accountsQueryGroupCRUD, { auth: true });

export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,
  // Custom extensions
};

// Re-export hooks
export * from './useAccounts';
export * from './useAccount';
export * from './useAccountCreate';
export * from './useAccountUpdate';
export * from './useAccountDelete';
```

## Best Practices

### 1. Keep Wrappers Thin

Wrappers should only handle cache keys and invalidation:

```typescript
// GOOD - Thin wrapper
export const useAccounts = () =>
  generatedUseAccounts({
    query: { queryKey: [accountsQueryGroup.list.queryKey] },
  });

// AVOID - Business logic in wrapper
export const useAccounts = () => {
  const result = generatedUseAccounts({
    query: { queryKey: [accountsQueryGroup.list.queryKey] },
  });

  const activeAccounts = result.data?.filter(a => a.isActive);
  const inactiveAccounts = result.data?.filter(a => !a.isActive);

  return { ...result, activeAccounts, inactiveAccounts };
};
```

Put business logic in custom hooks that use the wrapper:

```typescript
// GOOD - Separate concerns
export const useActiveAccounts = () => {
  const { data, ...rest } = useAccounts();
  const activeAccounts = useMemo(
    () => data?.filter(a => a.isActive) ?? [],
    [data]
  );
  return { data: activeAccounts, ...rest };
};
```

### 2. Always Provide Type Safety

Use KUBB's generated types:

```typescript
// GOOD
type AccountCreateProps = UseMutationOptions<
  AccountCreateMutationResponse,
  ResponseErrorConfig<AccountCreate400 | AccountCreate401>,
  { data: AccountCreateMutationRequest }
>;

// AVOID
export const useAccountCreate = ({ onSuccess, ...rest }: any) => ...
```

### 3. Preserve User Callbacks

Always call user-provided callbacks:

```typescript
// GOOD
onSuccess: (data, variables, context) => {
  // Framework logic first
  accountsQueryGroup.create.normalize?.(data);
  invalidateQueriesForKeys([...]);

  // Then user callback
  onSuccess?.(data, variables, context);
}

// AVOID - Overwrites user callback
onSuccess: (data, variables, context) => {
  accountsQueryGroup.create.normalize?.(data);
  invalidateQueriesForKeys([...]);
  // User callback never called!
}
```

### 4. Use Consistent Naming

```typescript
// GOOD - Mirrors entity name
useAccounts()       // List
useAccount(id)      // Detail
useAccountCreate()  // Create
useAccountUpdate()  // Update
useAccountDelete()  // Delete

// AVOID - Inconsistent
getAccounts()
fetchAccount(id)
createNewAccount()
```

### 5. Document Wrapper Purpose

Add JSDoc comments:

```typescript
/**
 * Fetches all accounts for the authenticated user.
 * Automatically includes cache key and auth context.
 *
 * @example
 * function AccountsList() {
 *   const { data: accounts } = useAccounts();
 *   return <ul>{accounts?.map(...)}</ul>;
 * }
 */
export const useAccounts = () =>
  generatedUseAccounts({
    query: { queryKey: [accountsQueryGroup.list.queryKey] },
  });
```

## Common Mistakes

### ❌ Not Using Query Keys

```typescript
// WRONG - No cache key provided
export const useAccounts = () => generatedUseAccounts();
```

### ❌ Static Query Keys for Dynamic Queries

```typescript
// WRONG - ID should be in the key
export const useAccount = (id: string) =>
  generatedUseAccount(id, {
    query: { queryKey: [accountsQueryGroup.list.queryKey] }, // Missing id!
  });

// CORRECT
export const useAccount = (id: string) =>
  generatedUseAccount(id, {
    query: { queryKey: [accountsQueryGroup.detail.queryKey(id)] },
  });
```

### ❌ Forgetting to Invalidate

```typescript
// WRONG - No invalidation
export const useAccountCreate = ({ onSuccess, ...rest }) =>
  generatedAccountCreate({
    mutation: {
      mutationKey: [accountsQueryGroup.create.queryKey],
      onSuccess: (data, variables, context) => {
        onSuccess?.(data, variables, context);
        // List query won't refetch!
      },
      ...rest,
    },
  });

// CORRECT
export const useAccountCreate = ({ onSuccess, ...rest }) =>
  generatedAccountCreate({
    mutation: {
      mutationKey: [accountsQueryGroup.create.queryKey],
      onSuccess: (data, variables, context) => {
        accountsQueryGroup.create.normalize?.(data);
        queryClient.invalidateQueries({
          queryKey: [accountsQueryGroup.create.invalidates],
        });
        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Summary

The wrapper hooks pattern:

- **Bridges** KUBB-generated hooks with CACHE-FLOW query keys
- **Enables** automatic invalidation and optimistic updates
- **Maintains** type safety from OpenAPI spec
- **Reduces** boilerplate in components
- **Centralizes** cache management logic

Every KUBB-generated hook should have a corresponding wrapper that injects the proper CACHE-FLOW query key.

## See Also

- [Query Groups](../core-concepts/query-groups.md) - Understanding query group structure
- [CRUD Factory](../core-concepts/crud-factory.md) - Generating query groups
- [Cascade Invalidation](./cascade-invalidation.md) - Multi-entity invalidation pattern
- [Optimistic Updates](./optimistic-updates.md) - Optimistic update pattern
