---
sidebar_position: 5
title: Entity Mapping
description: Map backend entity names to query keys for dynamic cache invalidation
---

# Entity Mapping

Entity mapping connects backend entity names to their corresponding query keys. This enables dynamic cache invalidation when the server tells you which entities changed.

## The Problem

When your backend returns affected entities (e.g., after a bulk operation), you need to invalidate the right caches:

```typescript
// Server response
{
  success: true,
  affectedEntities: ['transactions', 'accounts', 'movements']
}

// How do you map these strings to query keys?
```

## The Solution: Entity Map

Create a central mapping from entity names to query keys:

```typescript
import { accountsQueryGroup } from 'src/features/accounts/queries';
import { transactionsQueryGroup } from 'src/features/transactions/queries';
import { movementsQueryGroup } from 'src/features/movements/queries';
import { remindersQueryGroup } from 'src/features/reminders/queries';
import { recurrencesQueryGroup } from 'src/features/recurrences/queries';
import { QueryKey } from 'src/queries';

export const ENTITY_TO_QUERY_KEY_MAP: Record<string, QueryKey<any>> = {
  accounts: accountsQueryGroup.list.queryKey,
  transactions: transactionsQueryGroup.list.queryKey,
  movements: movementsQueryGroup.all.queryKey,
  reminders: remindersQueryGroup.all.queryKey,
  recurrences: recurrencesQueryGroup.all.queryKey,
  // Add all entities your backend might reference
};
```

## Helper Functions

### Get Query Keys from Entity Names

```typescript
export function getQueryKeysFromAffectedEntities(
  affectedEntities: string[]
): QueryKey<any>[] {
  return affectedEntities
    .map((entity) => ENTITY_TO_QUERY_KEY_MAP[entity])
    .filter(Boolean);  // Remove undefined (unknown entities)
}
```

### Invalidate Affected Entities

```typescript
import { invalidateQueriesForKeys } from 'src/queries';

export function invalidateAffectedEntities(affectedEntities: string[]): void {
  const keys = getQueryKeysFromAffectedEntities(affectedEntities);
  invalidateQueriesForKeys(keys);
}
```

## Usage Patterns

### After Bulk Operations

```typescript
export const useBulkDelete = () =>
  useMutation({
    mutationFn: bulkDeleteApi,
    onSuccess: (response) => {
      // Server tells us what was affected
      invalidateAffectedEntities(response.affectedEntities);
    },
  });
```

### In WebSocket Handlers

```typescript
socket.on('entities_changed', (data: { entities: string[] }) => {
  invalidateAffectedEntities(data.entities);
});
```

### After Import Operations

```typescript
export const useDataImport = () =>
  useMutation({
    mutationFn: importDataApi,
    onSuccess: (response) => {
      // Import affected multiple entity types
      invalidateAffectedEntities(response.importedEntities);

      toast.success(`Imported ${response.count} records`);
    },
  });
```

## Advanced Mapping

### With Detail Queries

For operations that affect specific items:

```typescript
interface EntityReference {
  entity: string;
  id?: string;
}

export const ENTITY_TO_QUERY_GROUP_MAP = {
  accounts: accountsQueryGroup,
  transactions: transactionsQueryGroup,
  // ...
};

export function getQueryKeysFromEntityReferences(
  refs: EntityReference[]
): QueryKey<any>[] {
  return refs.flatMap((ref) => {
    const group = ENTITY_TO_QUERY_GROUP_MAP[ref.entity];
    if (!group) return [];

    const keys = [group.all.queryKey];

    if (ref.id && 'detail' in group) {
      keys.push(group.detail.queryKey(ref.id));
    }

    return keys;
  });
}
```

### Hierarchical Invalidation

Some entities have relationships that require cascade invalidation:

```typescript
const ENTITY_DEPENDENCIES: Record<string, string[]> = {
  accounts: ['transactions', 'movements', 'reminders'],
  transactions: ['movements'],
  categories: ['transactions'],
};

export function invalidateWithDependencies(entities: string[]): void {
  const allEntities = new Set<string>();

  // Add direct entities
  entities.forEach((e) => allEntities.add(e));

  // Add dependencies
  entities.forEach((entity) => {
    ENTITY_DEPENDENCIES[entity]?.forEach((dep) => allEntities.add(dep));
  });

  invalidateAffectedEntities([...allEntities]);
}
```

## Real-World Example: Recalculation Service

When a background job recalculates data:

```typescript
// Backend response
interface RecalculationResult {
  taskId: string;
  status: 'completed';
  affectedEntities: string[];
  affectedAccounts: string[];
}

// Frontend handler
export const useRecalculationComplete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkRecalculationStatus,
    onSuccess: (result: RecalculationResult) => {
      // Invalidate all affected entity lists
      invalidateAffectedEntities(result.affectedEntities);

      // Also invalidate specific account details
      result.affectedAccounts.forEach((accountId) => {
        queryClient.invalidateQueries({
          queryKey: [accountsQueryGroup.detail.queryKey(accountId)],
        });
      });
    },
  });
};
```

## Integration with Server Events

### Polling for Changes

```typescript
const { data: changes } = useQuery({
  queryKey: ['sync', 'changes'],
  queryFn: fetchPendingChanges,
  refetchInterval: 30000,  // Poll every 30s
});

useEffect(() => {
  if (changes?.affectedEntities?.length) {
    invalidateAffectedEntities(changes.affectedEntities);
  }
}, [changes]);
```

### Server-Sent Events

```typescript
useEffect(() => {
  const eventSource = new EventSource('/api/events');

  eventSource.addEventListener('cache_invalidate', (event) => {
    const { entities } = JSON.parse(event.data);
    invalidateAffectedEntities(entities);
  });

  return () => eventSource.close();
}, []);
```

## Type Safety

Make the mapping type-safe:

```typescript
// Define valid entity names
type EntityName =
  | 'accounts'
  | 'transactions'
  | 'movements'
  | 'reminders'
  | 'recurrences'
  | 'categories';

// Type-safe map
export const ENTITY_TO_QUERY_KEY_MAP: Record<EntityName, QueryKey<any>> = {
  accounts: accountsQueryGroup.list.queryKey,
  transactions: transactionsQueryGroup.list.queryKey,
  movements: movementsQueryGroup.all.queryKey,
  reminders: remindersQueryGroup.all.queryKey,
  recurrences: recurrencesQueryGroup.all.queryKey,
  categories: categoriesQueryGroup.list.queryKey,
};

// Type-safe function
export function invalidateAffectedEntities(
  entities: EntityName[]
): void {
  const keys = entities.map((e) => ENTITY_TO_QUERY_KEY_MAP[e]);
  invalidateQueriesForKeys(keys);
}
```

## Best Practices

### 1. Keep the Map Centralized

Put the entity map in a single file that imports all query groups:

```
src/
  queries/
    index.ts          # Core CACHE-FLOW utilities
    entityMap.ts      # Entity mapping (imports from features)
```

### 2. Handle Unknown Entities Gracefully

```typescript
export function getQueryKeysFromAffectedEntities(
  entities: string[]
): QueryKey<any>[] {
  return entities
    .map((entity) => {
      const key = ENTITY_TO_QUERY_KEY_MAP[entity];
      if (!key) {
        console.warn(`Unknown entity in invalidation: ${entity}`);
      }
      return key;
    })
    .filter(Boolean);
}
```

### 3. Use `all` Keys for Broad Invalidation

When the server says "transactions changed" without specifics, use the `all` key:

```typescript
// Invalidates ALL transaction queries (list, detail, filtered, etc.)
transactions: transactionsQueryGroup.all.queryKey
```

### 4. Document the Contract

Keep backend and frontend entity names synchronized:

```typescript
/**
 * Entity names must match the backend's entity identifiers.
 * See: /backend/docs/entities.md
 *
 * @example
 * Backend returns: { affectedEntities: ['accounts', 'transactions'] }
 * Frontend maps to: [accountsQueryGroup.list.queryKey, ...]
 */
export const ENTITY_TO_QUERY_KEY_MAP = { ... };
```

## Summary

Entity mapping provides:

1. **Dynamic invalidation** - React to server-reported changes
2. **Decoupled code** - Backend and frontend don't share cache logic
3. **Flexible integration** - Works with REST, WebSockets, SSE, polling
4. **Type safety** - Catch invalid entity names at compile time

This pattern is essential when your backend performs operations that affect multiple entity types (imports, exports, bulk operations, background jobs).
