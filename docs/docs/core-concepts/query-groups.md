# Query Groups

Query groups organize related cache keys, invalidation rules, and normalization functions for a single entity. They are the building blocks of CACHE-FLOW's automatic cache management.

## The QueryGroup Interface

```typescript
export interface QueryGroup<T> {
  queryKey: QueryKey<T>;
  invalidates?: QueryKey<T>;
  type?: 'query' | 'mutation';
  normalize?: (data: any) => void;
}
```

### Fields Explained

| Field | Description | Example |
|-------|-------------|---------|
| `queryKey` | The cache key for this operation | `{ entity: 'accounts', method: 'list' }` |
| `invalidates` | Keys to invalidate after mutation | `{ entity: 'accounts', method: 'list' }` |
| `type` | Operation type (`query` or `mutation`) | `'query'`, `'mutation'` |
| `normalize` | Function to optimistically update cache | `(data) => { ... }` |

## Simple Query Groups

For basic read-only entities:

```typescript
export const currenciesQueryGroup = {
  list: {
    queryKey: { entity: 'currencies', method: 'list' },
    type: 'query',
  },
};
```

Usage:

```typescript
useQuery({
  queryKey: [currenciesQueryGroup.list.queryKey],
  queryFn: fetchCurrencies,
});
```

## CRUD Query Groups

For entities with full create, read, update, delete operations, use `createQueryGroupCRUD`:

```typescript
import { createQueryGroupCRUD } from 'src/queries';

const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');
```

This generates:

```typescript
{
  all: {
    queryKey: { entity: 'accounts' }
  },
  list: {
    queryKey: { entity: 'accounts', method: 'list' },
    type: 'query'
  },
  detail: {
    queryKey: (id) => ({ entity: 'accounts', method: 'detail', id }),
    type: 'query',
    normalize: (data) => { /* updates list cache */ }
  },
  create: {
    queryKey: { entity: 'accounts', method: 'create' },
    invalidates: { entity: 'accounts', method: 'list' },
    type: 'mutation',
    normalize: (data) => { /* adds to list cache */ }
  },
  update: {
    queryKey: (id) => ({ entity: 'accounts', method: 'update', id }),
    invalidates: (id) => [
      { entity: 'accounts', id },
      { entity: 'accounts', method: 'list' }
    ],
    type: 'mutation',
    normalize: (data) => { /* updates list and detail cache */ }
  },
  remove: {
    queryKey: (id) => ({ entity: 'accounts', method: 'remove', id }),
    invalidates: (id) => [
      { entity: 'accounts', id },
      { entity: 'accounts', method: 'list' }
    ],
    type: 'mutation',
    normalize: (data) => { /* removes from list cache */ }
  }
}
```

## Query vs Mutation Groups

### Query Groups

For read operations (GET requests):

```typescript
const list: QueryGroup<string> = {
  queryKey: { entity: 'accounts', method: 'list' },
  type: 'query',
};
```

Characteristics:
- No `invalidates` field (queries don't invalidate)
- May have `normalize` for optimistic updates
- Used with `useQuery` or `useSuspenseQuery`

### Mutation Groups

For write operations (POST, PUT, DELETE):

```typescript
const create: QueryGroup<string> = {
  queryKey: { entity: 'accounts', method: 'create' },
  invalidates: { entity: 'accounts', method: 'list' },
  type: 'mutation',
  normalize: (data) => {
    // Add new item to cache
  },
};
```

Characteristics:
- Always has `invalidates` field
- Always has `normalize` for optimistic updates
- Used with `useMutation`

## Automatic Invalidation

Query groups define which caches to invalidate after mutations:

```typescript
// When creating an account...
create: {
  invalidates: { entity: 'accounts', method: 'list' }
}

// When updating an account...
update: {
  invalidates: (id) => [
    { entity: 'accounts', id },
    { entity: 'accounts', method: 'list' }
  ]
}
```

Usage in mutation:

```typescript
const createAccount = useMutation({
  mutationFn: createAccountAPI,
  onSuccess: (data) => {
    invalidateQueriesForKeys([accountsQueryGroup.create.invalidates]);
  },
});
```

## Optimistic Updates with Normalize

The `normalize` function updates the cache immediately without waiting for invalidation:

```typescript
create: {
  normalize: (data: { id: any }) => {
    // Add new item to list cache
    queryClient.setQueryData([list.queryKey], (old: any) => {
      if (!old) return [data];
      return [...old, data];
    });
    // Also set detail cache
    queryClient.setQueryData([detail.queryKey(data.id)], data);
  }
}
```

Usage:

```typescript
const createAccount = useMutation({
  mutationFn: createAccountAPI,
  onSuccess: (data) => {
    // Apply optimistic update
    accountsQueryGroup.create.normalize?.(data);
    // Still invalidate for consistency
    invalidateQueriesForKeys([accountsQueryGroup.create.invalidates]);
  },
});
```

## Custom Query Groups

You can create custom query groups for specialized operations:

```typescript
export const accountsQueryGroup = {
  // Standard CRUD
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

  // Custom: Archive account
  archive: {
    queryKey: (id: string) => ({
      entity: 'accounts',
      method: 'archive',
      id
    }),
    invalidates: (id: string) => [
      { entity: 'accounts', id },
      { entity: 'accounts', method: 'list' },
    ],
    type: 'mutation' as const,
  },
};
```

## Resolved Query Groups

For operations that need parameters (like an ID), use resolved variants:

```typescript
export interface QueryGroupResolved<T> {
  queryKey: (...args: T[]) => QueryKey<T>;
  invalidates?: (...args: T[]) => QueryKey<T>;
  type?: 'query' | 'mutation';
  normalize?: (data: any) => void;
}
```

Example:

```typescript
const detail: QueryGroupResolved<string> = {
  queryKey: (id: string) => ({
    entity: 'accounts',
    method: 'detail',
    id
  }),
  type: 'query',
};

// Usage
useQuery({
  queryKey: [accountsQueryGroup.detail.queryKey('123')],
  queryFn: () => fetchAccount('123'),
});
```

## Best Practices

### 1. One Query Group Per Entity

```typescript
// Good
const accountsQueryGroup = createQueryGroupCRUD('accounts');
const transactionsQueryGroup = createQueryGroupCRUD('transactions');

// Bad - don't mix entities
const queryGroups = {
  accounts: { ... },
  transactions: { ... },
};
```

### 2. Export Query Groups

```typescript
// src/features/accounts/queries/index.ts
export const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');
```

### 3. Use CRUD Factory When Possible

```typescript
// Good - leverages built-in invalidation
const accountsQueryGroup = createQueryGroupCRUD('accounts');

// Less good - manual definition (more work)
const accountsQueryGroup = {
  list: { queryKey: { entity: 'accounts', method: 'list' } },
  detail: { queryKey: (id) => ({ entity: 'accounts', method: 'detail', id }) },
  // ... manual invalidation rules
};
```

### 4. Extend, Don't Replace

```typescript
// Good - extend CRUD with custom operations
const accountsQueryGroup = {
  ...createQueryGroupCRUD('accounts'),
  archive: { ... },
  restore: { ... },
};

// Bad - replace everything
const accountsQueryGroup = {
  myCustomListKey: { ... },
};
```

## Next Steps

- [CRUD Factory](crud-factory) - Deep dive into `createQueryGroupCRUD`
- [Key Injection](key-injection) - Add shared context to query groups
- [Cascade Invalidation](../patterns/cascade-invalidation) - Master automatic invalidation
