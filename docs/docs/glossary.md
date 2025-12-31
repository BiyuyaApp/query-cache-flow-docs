---
sidebar_position: 100
title: Glossary
description: Key terms and definitions used in Query Cache Flow documentation
---

# Glossary

This glossary defines key terms used throughout the Query Cache Flow documentation.

## Core Concepts

### Cache Key
A unique identifier used by TanStack Query to store and retrieve cached data. In Query Cache Flow, cache keys are structured objects with `entity`, `method`, and optionally `id` properties.

```typescript
// Example cache key
{ entity: 'accounts', method: 'list' }
```

### Entity
A resource type in your application, typically corresponding to a database table or API resource. Examples: `accounts`, `transactions`, `users`.

### Query Group
A collection of related query keys, invalidation rules, and normalize functions for a single entity. Created using `createQueryGroupCRUD()`.

```typescript
const accountsQueryGroup = createQueryGroupCRUD('accounts');
// Contains: all, list, detail, create, update, remove
```

### QueryKey Type
The TypeScript type that defines the structure of all Query Cache Flow cache keys:

```typescript
type QueryKey<T> = {
  entity: string;
  method?: 'list' | 'detail' | 'create' | 'update' | 'remove' | string;
  id?: T;
};
```

## Operations

### Normalize (Function)
A function that optimistically updates the cache immediately after a mutation, without waiting for server confirmation. Each CRUD operation has a built-in normalize function:

- **create.normalize**: Adds new item to list cache, sets detail cache
- **update.normalize**: Updates item in both list and detail caches
- **remove.normalize**: Removes item from list cache, clears detail cache
- **detail.normalize**: Updates single item in list cache

```typescript
// Example usage
accountsQueryGroup.create.normalize?.(newAccountData);
```

### Invalidate
To mark cached data as stale, triggering a refetch when the query is next accessed. Query Cache Flow provides `invalidateQueriesForKeys()` for batch invalidation.

```typescript
invalidateQueriesForKeys([
  { entity: 'accounts', method: 'list' }
]);
```

### Cancel
To abort in-flight queries, typically done before optimistic updates to prevent race conditions. Query Cache Flow provides `cancelQueriesForKeys()`.

```typescript
cancelQueriesForKeys([
  { entity: 'accounts', method: 'list' }
]);
```

## Patterns

### Wrapper Hook
A thin function that wraps a KUBB-generated hook, injecting Query Cache Flow query keys and invalidation logic. This is the main integration point between KUBB and Query Cache Flow.

```typescript
export const useAccounts = () =>
  generatedUseAccounts({
    query: { queryKey: [accountsQueryGroup.list.queryKey] },
  });
```

### Cascade Invalidation
The pattern of invalidating multiple related queries when an entity changes. For example, deleting an account invalidates not just account queries but also transaction, balance, and reminder queries.

### Key Injection
Using `inyectKeysToQueries()` to add shared properties (like `auth: true`) to all query keys in a query group.

```typescript
accountsQueryGroup = inyectKeysToQueries(accountsQueryGroup, { auth: true });
// All keys now include: { ..., auth: true }
```

### Optimistic Update
Updating the UI immediately when a mutation starts, before the server responds. If the mutation fails, the update is rolled back.

## TanStack Query Terms

### Query
A declarative dependency on an asynchronous source of data. Queries are cached and automatically refetched based on configuration.

### Mutation
An operation that creates, updates, or deletes data. Unlike queries, mutations are not cached and must be triggered manually.

### Stale
Data that has exceeded its `staleTime` and will be refetched in the background when accessed.

### QueryClient
The TanStack Query client that manages all query caching, invalidation, and refetching. Query Cache Flow utilities use the QueryClient internally.

## Tools & Libraries

### KUBB
A code generator that reads OpenAPI specifications and produces TypeScript types and React Query hooks. Query Cache Flow wraps KUBB-generated hooks with cache key management.

### OpenAPI / Swagger
A specification for describing REST APIs. KUBB reads OpenAPI specs to generate type-safe code.

### TanStack Query (React Query)
The underlying data fetching and caching library that Query Cache Flow builds upon. Provides `useQuery`, `useMutation`, and the QueryClient.

## Methods

### list
A query that fetches all records of an entity. Cache key: `{ entity: 'xxx', method: 'list' }`

### detail
A query that fetches a single record by ID. Cache key: `{ entity: 'xxx', method: 'detail', id: 'yyy' }`

### create
A mutation that creates a new record. Cache key: `{ entity: 'xxx', method: 'create' }`

### update
A mutation that updates an existing record. Cache key: `{ entity: 'xxx', method: 'update', id: 'yyy' }`

### remove
A mutation that deletes a record. Cache key: `{ entity: 'xxx', method: 'remove', id: 'yyy' }`

### all
A reference to all queries for an entity, regardless of method. Used for broad invalidation. Cache key: `{ entity: 'xxx' }`

## See Also

- [Introduction](./intro.md) - Overview of Query Cache Flow
- [Query Keys](./core-concepts/query-keys.md) - Deep dive into cache key structure
- [Query Groups](./core-concepts/query-groups.md) - Understanding query group structure
