# Quick Start

This guide will walk you through creating your first CACHE-FLOW query group and using it in a React component.

## Step 1: Define Your Entity Query Group

Let's create a query group for managing "accounts" in your application.

Create `src/features/accounts/queries/index.ts`:

```typescript
import { createQueryGroupCRUD } from 'src/queries';

// Create a complete CRUD query group for accounts
export const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');
```

That's it! This single line creates all the cache keys you need:

```typescript
accountsQueryGroup.all       // { entity: 'accounts' }
accountsQueryGroup.list      // { entity: 'accounts', method: 'list' }
accountsQueryGroup.detail    // (id) => { entity: 'accounts', method: 'detail', id }
accountsQueryGroup.create    // { entity: 'accounts', method: 'create' }
accountsQueryGroup.update    // (id) => { entity: 'accounts', method: 'update', id }
accountsQueryGroup.remove    // (id) => { entity: 'accounts', method: 'remove', id }
```

## Step 2: Wrap KUBB-Generated Hooks

If you're using KUBB to generate hooks from your OpenAPI spec, wrap them with CACHE-FLOW:

```typescript
// src/features/accounts/queries/hooks.ts
import { useGetAccounts as generatedUseAccounts } from 'src/generated/hooks';
import { accountsQueryGroup } from './index';

export const useAccounts = () =>
  generatedUseAccounts({
    query: {
      queryKey: [accountsQueryGroup.list.queryKey],
    },
  });
```

If you're not using KUBB, create your own query hook:

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchAccounts } from 'src/api/accounts';
import { accountsQueryGroup } from './index';

export const useAccounts = () =>
  useQuery({
    queryKey: [accountsQueryGroup.list.queryKey],
    queryFn: fetchAccounts,
  });
```

## Step 3: Use in a Component

Now use your query hook in a React component:

```tsx
import { useAccounts } from 'src/features/accounts/queries/hooks';

function AccountsList() {
  const { data: accounts, isLoading, error } = useAccounts();

  if (isLoading) return <div>Loading accounts...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {accounts?.map((account) => (
        <li key={account.id}>{account.name}</li>
      ))}
    </ul>
  );
}
```

## Step 4: Add Mutation Hooks

Create mutation hooks for creating, updating, and deleting accounts:

```typescript
// src/features/accounts/queries/hooks.ts
import { useMutation } from '@tanstack/react-query';
import { createAccount, updateAccount, deleteAccount } from 'src/api/accounts';
import { accountsQueryGroup } from './index';
import { invalidateQueriesForKeys } from 'src/queries';

export const useCreateAccount = () =>
  useMutation({
    mutationFn: createAccount,
    onSuccess: (data) => {
      // Automatically invalidate the list query
      invalidateQueriesForKeys([accountsQueryGroup.create.invalidates]);
      // Optionally apply optimistic update
      accountsQueryGroup.create.normalize?.(data);
    },
  });

export const useUpdateAccount = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateAccount(id, data),
    onSuccess: (data, variables) => {
      // Invalidate both the detail and list queries
      invalidateQueriesForKeys(accountsQueryGroup.update.invalidates(variables.id));
      // Apply optimistic update
      accountsQueryGroup.update.normalize?.(data);
    },
  });

export const useDeleteAccount = () =>
  useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: (data, id) => {
      // Invalidate related queries
      invalidateQueriesForKeys(accountsQueryGroup.remove.invalidates(id));
      // Update cache
      accountsQueryGroup.remove.normalize?.({ id });
    },
  });
```

## Step 5: Use Mutations in Components

```tsx
import { useCreateAccount, useDeleteAccount } from 'src/features/accounts/queries/hooks';

function AccountsManager() {
  const { data: accounts } = useAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();

  const handleCreate = async () => {
    await createAccount.mutateAsync({
      name: 'New Account',
      balance: 0,
    });
    // List automatically refreshes!
  };

  const handleDelete = async (id: string) => {
    await deleteAccount.mutateAsync(id);
    // List automatically updates!
  };

  return (
    <div>
      <button onClick={handleCreate}>Create Account</button>
      <ul>
        {accounts?.map((account) => (
          <li key={account.id}>
            {account.name}
            <button onClick={() => handleDelete(account.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## What Just Happened?

With CACHE-FLOW, you get:

1. **Consistent cache keys** - All queries use the same structured format
2. **Automatic invalidation** - Mutations invalidate related queries automatically
3. **Optimistic updates** - Built-in `normalize` functions update the cache immediately
4. **Type safety** - Full TypeScript support with generic types
5. **Zero thinking** - No manual cache key management required

## Next Steps

- [Project Structure](project-structure) - Learn how to organize your query groups
- [Query Keys](../core-concepts/query-keys) - Understand the cache key structure
- [Cascade Invalidation](../patterns/cascade-invalidation) - Master automatic invalidation
- [Optimistic Updates](../patterns/optimistic-updates) - Implement instant UI feedback
