---
sidebar_position: 3
title: Migration Guide
description: Migrate from manual query keys to CACHE-FLOW
---

# Migration Guide

This guide walks you through migrating an existing TanStack Query codebase to CACHE-FLOW.

## Before You Start

### Assess Your Current Setup

1. **How many query keys do you have?** Check for patterns like:
   ```typescript
   queryKey: ['accounts']
   queryKey: ['accounts', accountId]
   queryKey: ['transactions', { accountId, page }]
   ```

2. **How is invalidation handled?** Look for:
   ```typescript
   queryClient.invalidateQueries({ queryKey: ['accounts'] })
   ```

3. **Are you using KUBB?** If not, CACHE-FLOW still helps, but you'll write hooks manually.

## Migration Steps

### Phase 1: Add CACHE-FLOW Core

#### Step 1: Create the Core File

```typescript
// src/queries/index.ts
import { InvalidateQueryFilters } from '@tanstack/react-query';
import queryClient from './client';

export type QueryKey<T> = {
  entity: string;
  method?: 'list' | 'detail' | 'create' | 'update' | 'remove' | string;
  id?: T;
};

export interface QueryGroup<T> {
  queryKey: QueryKey<T>;
  invalidates?: QueryKey<T>;
  type?: 'query' | 'mutation';
  normalize?: (data: any) => void;
}

export interface QueryGroupResolved<T> {
  queryKey: (...args: T[]) => QueryKey<T>;
  invalidates?: (...args: T[]) => QueryKey<T>;
  type?: 'query' | 'mutation';
  normalize?: (data: any) => void;
}

export interface QueryGroupMutationResolved<T> {
  invalidates: (...args: T[]) => QueryKey<T>[];
  queryKey: (...args: T[]) => QueryKey<T>;
  type?: 'query' | 'mutation';
  normalize?: (data: any) => void;
}

export interface QueryGroupCRUD<T> {
  all: QueryGroup<T>;
  list: QueryGroup<T>;
  detail: QueryGroupResolved<T>;
  create: QueryGroup<T>;
  update: QueryGroupMutationResolved<T>;
  remove: QueryGroupMutationResolved<T>;
}

// Helper to resolve keys
const resolveKey = <T>(
  key: QueryKey<T> | ((...args: T[]) => QueryKey<T>),
  ...args: T[]
): QueryKey<T> => {
  return typeof key === 'function' ? key(...args) : key;
};

export const createQueryGroupCRUD = <T = string>(entityName: string): QueryGroupCRUD<T> => {
  const all: QueryGroup<T> = {
    queryKey: { entity: entityName },
  };

  const list: QueryGroup<T> = {
    queryKey: { entity: entityName, method: 'list' },
    type: 'query',
  };

  const detail: QueryGroupResolved<T> = {
    queryKey: (id: T) => ({ entity: entityName, method: 'detail', id }),
    type: 'query',
    normalize: (data: any) => {
      queryClient.setQueryData([resolveKey(list.queryKey)], (old: any) => {
        if (!old) return old;
        return old.map((item: any) => (item.id === data.id ? data : item));
      });
    },
  };

  const create: QueryGroup<T> = {
    queryKey: { entity: entityName, method: 'create' },
    invalidates: { entity: entityName, method: 'list' },
    type: 'mutation',
    normalize: (data: { id: any }) => {
      queryClient.setQueryData([resolveKey(list.queryKey)], (old: any) => {
        if (!old) return [data];
        return [...old, data];
      });
      queryClient.setQueryData([resolveKey(detail.queryKey, data.id)], data);
    },
  };

  const update: QueryGroupMutationResolved<T> = {
    queryKey: (id: T) => ({ entity: entityName, method: 'update', id }),
    invalidates: (id: T) => [
      { entity: entityName, id },
      { entity: entityName, method: 'list' },
    ],
    type: 'mutation',
    normalize: (data: { id: any }) => {
      queryClient.setQueryData([resolveKey(list.queryKey)], (old: any) => {
        if (!old) return old;
        return old.map((item: any) => (item.id === data.id ? data : item));
      });
      queryClient.setQueryData([resolveKey(detail.queryKey, data.id)], data);
    },
  };

  const remove: QueryGroupMutationResolved<T> = {
    queryKey: (id: T) => ({ entity: entityName, method: 'remove', id }),
    invalidates: (id: T) => [
      { entity: entityName, id },
      { entity: entityName, method: 'list' },
    ],
    type: 'mutation',
    normalize: (data: { id: any }) => {
      queryClient.setQueryData([resolveKey(list.queryKey)], (old: any) => {
        if (!old) return old;
        return old.filter((item: any) => item.id !== data.id);
      });
      queryClient.setQueryData([resolveKey(detail.queryKey, data.id)], undefined);
    },
  };

  return { all, list, detail, create, update, remove };
};

export const invalidateQueriesForKeys = (
  keys: Array<QueryKey<string>>,
  invalidateOptions?: InvalidateQueryFilters
): void => {
  keys.filter(Boolean).forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key], ...invalidateOptions });
  });
};

export const cancelQueriesForKeys = (keys: Array<QueryKey<string>>): void => {
  keys.filter(Boolean).forEach((key) => {
    queryClient.cancelQueries({ queryKey: [key] });
  });
};

export const inyectKeysToQueries = <T extends Record<string, any>>(
  queries: T,
  extra: Record<string, any>
): T => {
  const process = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(process);
    } else if (obj && typeof obj === 'object') {
      if (Object.prototype.hasOwnProperty.call(obj, 'queryKey')) {
        if (typeof obj.queryKey === 'function') {
          const originalFn = obj.queryKey;
          obj.queryKey = (...args: any[]) => {
            const key = originalFn(...args);
            if (key && typeof key === 'object' && !Array.isArray(key)) {
              return { ...key, ...extra };
            }
            return key;
          };
        } else if (obj.queryKey && typeof obj.queryKey === 'object') {
          obj.queryKey = { ...obj.queryKey, ...extra };
        }
      }
      for (const prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
          obj[prop] = process(obj[prop]);
        }
      }
    }
    return obj;
  };
  return process(queries);
};
```

### Phase 2: Migrate One Feature

Choose a simple feature (e.g., accounts) to migrate first.

#### Before: Manual Keys

```typescript
// Old: src/features/accounts/hooks.ts
export const useAccounts = () =>
  useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

export const useAccount = (id: string) =>
  useQuery({
    queryKey: ['accounts', id],
    queryFn: () => fetchAccount(id),
  });

export const useCreateAccount = () =>
  useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
```

#### After: CACHE-FLOW

```typescript
// New: src/features/accounts/queries/index.ts
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';

let accountsQueryGroupCRUD = createQueryGroupCRUD<string>('accounts');
accountsQueryGroupCRUD = inyectKeysToQueries(accountsQueryGroupCRUD, { auth: true });

export const accountsQueryGroup = accountsQueryGroupCRUD;

// New: src/features/accounts/queries/useAccounts.ts
export const useAccounts = () =>
  useQuery({
    queryKey: [accountsQueryGroup.list.queryKey],
    queryFn: fetchAccounts,
  });

// New: src/features/accounts/queries/useAccount.ts
export const useAccount = (id: string) =>
  useQuery({
    queryKey: [accountsQueryGroup.detail.queryKey(id)],
    queryFn: () => fetchAccount(id),
  });

// New: src/features/accounts/queries/useAccountCreate.ts
export const useAccountCreate = () =>
  useMutation({
    mutationFn: createAccount,
    onSuccess: (data) => {
      accountsQueryGroup.create.normalize?.(data);
      invalidateQueriesForKeys([accountsQueryGroup.create.invalidates!]);
    },
  });
```

### Phase 3: Update Imports

Replace old imports with new ones:

```typescript
// Before
import { useAccounts, useAccount, useCreateAccount } from 'src/features/accounts/hooks';

// After
import { useAccounts } from 'src/features/accounts/queries/useAccounts';
import { useAccount } from 'src/features/accounts/queries/useAccount';
import { useAccountCreate } from 'src/features/accounts/queries/useAccountCreate';
```

### Phase 4: Migrate Remaining Features

Repeat Phase 2-3 for each feature:

1. Create query group in `queries/index.ts`
2. Create wrapper hooks
3. Update imports in components
4. Test the feature

### Phase 5: Remove Old Code

Once all features are migrated:

1. Delete old hook files
2. Search for any remaining raw `queryKey: ['...']` patterns
3. Remove unused imports

## Key Mapping Reference

| Old Pattern | New Pattern |
|-------------|-------------|
| `['entity']` | `entityQueryGroup.all.queryKey` |
| `['entity', 'list']` | `entityQueryGroup.list.queryKey` |
| `['entity', id]` | `entityQueryGroup.detail.queryKey(id)` |
| `['entity', { ...params }]` | `entityQueryGroup.list.queryKey(params)` |

## Handling Edge Cases

### Custom Query Keys

If you have custom keys that don't fit CRUD:

```typescript
export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,
  // Add custom queries
  associates: {
    queryKey: { entity: 'accounts', scope: 'associates', method: 'list' },
  },
  statistics: {
    queryKey: (accountId: string) => ({
      entity: 'accounts',
      scope: 'statistics',
      id: accountId,
    }),
  },
};
```

### Complex Invalidation

If mutations affect multiple entities:

```typescript
export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,
  remove: {
    ...accountsQueryGroupCRUD.remove,
    invalidates: (id: string) => [
      ...accountsQueryGroupCRUD.remove.invalidates(id),
      transactionsQueryGroup.all.queryKey,
      movementsQueryGroup.all.queryKey,
    ],
  },
};
```

### Paginated Queries

```typescript
export const remindersQueryGroup = {
  ...remindersQueryGroupCRUD,
  list: {
    queryKey: (params?: QueryParams) => ({
      ...remindersQueryGroupCRUD.list.queryKey,
      query: params,
    }),
  },
};
```

## Verification Checklist

After migration, verify:

- [ ] All queries use CACHE-FLOW keys
- [ ] All mutations invalidate properly
- [ ] No raw `queryKey: ['...']` patterns remain
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Manual testing confirms cache behavior

## Common Pitfalls

### 1. Forgetting to Update Invalidation

```typescript
// Wrong - old pattern
queryClient.invalidateQueries({ queryKey: ['accounts'] });

// Right - new pattern
invalidateQueriesForKeys([accountsQueryGroup.list.queryKey]);
```

### 2. Using Wrong Key Level

```typescript
// Wrong - too broad (invalidates everything)
invalidateQueriesForKeys([accountsQueryGroup.all.queryKey]);

// Right - specific to list
invalidateQueriesForKeys([accountsQueryGroup.list.queryKey]);
```

### 3. Missing Key Wrapper

```typescript
// Wrong - missing array wrapper
queryKey: accountsQueryGroup.list.queryKey

// Right - wrapped in array
queryKey: [accountsQueryGroup.list.queryKey]
```

## Rollback Plan

If issues arise:

1. Keep old code commented until migration is verified
2. Use feature flags to toggle between old/new implementations
3. Deploy incrementally, one feature at a time

## Summary

Migration to CACHE-FLOW involves:

1. Adding core CACHE-FLOW utilities
2. Creating query groups for each feature
3. Wrapping existing hooks
4. Updating imports
5. Removing old code

Take it one feature at a time, test thoroughly, and enjoy zero-thought cache management!
