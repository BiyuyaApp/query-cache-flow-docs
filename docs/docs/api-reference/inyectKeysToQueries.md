# inyectKeysToQueries

Recursively injects additional properties into all `queryKey` objects within a query group structure. Essential for adding global context like authentication flags, tenant IDs, or user scopes to all queries.

## Type Signature

```typescript
export const inyectKeysToQueries = <T extends Record<string, any>>(
  queries: T,
  extra: Record<string, any>,
): T
```

## Parameters

### `queries`

- **Type**: `T extends Record<string, any>`
- **Required**: Yes
- **Description**: The query group object to process (typically from `createQueryGroupCRUD`)

### `extra`

- **Type**: `Record<string, any>`
- **Required**: Yes
- **Description**: Object containing properties to inject into all queryKeys

## Return Value

- **Type**: `T`
- **Description**: A new query group with injected properties in all queryKeys

## How It Works

The function recursively processes the query group object and:

1. **Identifies queryKey properties** (both static objects and functions)
2. **Merges extra properties** into each queryKey
3. **Preserves function signatures** for dynamic keys
4. **Processes nested structures** recursively

```typescript
export const inyectKeysToQueries = <T extends Record<string, any>>(
  queries: T,
  extra: Record<string, any>,
): T => {
  const process = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(process);
    } else if (obj && typeof obj === 'object') {
      // If object has 'queryKey' property, inject extras
      if (Object.prototype.hasOwnProperty.call(obj, 'queryKey')) {
        if (typeof obj.queryKey === 'function') {
          // Handle function-based queryKeys
          const originalFn = obj.queryKey;
          obj.queryKey = (...args: any[]) => {
            const key = originalFn(...args);
            if (key && typeof key === 'object' && !Array.isArray(key)) {
              return { ...key, ...extra };
            }
            return key;
          };
        } else if (obj.queryKey && typeof obj.queryKey === 'object') {
          // Handle static object queryKeys
          obj.queryKey = { ...obj.queryKey, ...extra };
        }
      }
      // Recursively process all properties
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

## Basic Example

```typescript
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';
import { Account } from 'src/generated';

// Create base query group
let accountsQueryGroup = createQueryGroupCRUD<Account['id']>('accounts');

// Inject auth flag into ALL query keys
accountsQueryGroup = inyectKeysToQueries(accountsQueryGroup, { auth: true });

// All keys now include { auth: true }
console.log(accountsQueryGroup.list.queryKey);
// { entity: 'accounts', method: 'list', auth: true }

console.log(accountsQueryGroup.detail.queryKey('123'));
// { entity: 'accounts', method: 'detail', id: '123', auth: true }
```

## Common Use Cases

### 1. Authentication Context

The most common use case - marking all queries as authenticated:

```typescript
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';

// All authenticated resources
const createAuthQueryGroup = <T>(entityName: string) => {
  let group = createQueryGroupCRUD<T>(entityName);
  return inyectKeysToQueries(group, { auth: true });
};

export const accountsQueryGroup = createAuthQueryGroup<Account['id']>('accounts');
export const transactionsQueryGroup = createAuthQueryGroup<Transaction['id']>('transactions');
export const usersQueryGroup = createAuthQueryGroup<User['id']>('users');
```

### 2. Multi-Tenancy

Add tenant context to all queries:

```typescript
const tenantId = getCurrentTenantId();

let productsQueryGroup = createQueryGroupCRUD<Product['id']>('products');

productsQueryGroup = inyectKeysToQueries(productsQueryGroup, {
  tenantId,
  auth: true,
});

// All product queries now isolated by tenant
// { entity: 'products', method: 'list', tenantId: 'tenant-42', auth: true }
```

### 3. User Scope

Different cache keys for different user roles:

```typescript
const userRole = getCurrentUserRole(); // 'admin' | 'user'

let reportsQueryGroup = createQueryGroupCRUD<Report['id']>('reports');

reportsQueryGroup = inyectKeysToQueries(reportsQueryGroup, {
  scope: userRole,
  auth: true,
});

// Admin queries: { entity: 'reports', method: 'list', scope: 'admin', auth: true }
// User queries: { entity: 'reports', method: 'list', scope: 'user', auth: true }
```

### 4. Feature Flags

Include active features in cache keys:

```typescript
const features = getActiveFeatures(); // ['beta-ui', 'advanced-metrics']

let analyticsQueryGroup = createQueryGroupCRUD('analytics');

analyticsQueryGroup = inyectKeysToQueries(analyticsQueryGroup, {
  features,
  auth: true,
});

// Different cache for users with different feature sets
```

## Real-World Example

From a production application:

```typescript
import { movementsQueryGroup } from 'src/features/movements/queries';
import { recurrencesQueryGroup } from 'src/features/recurrences/queries';
import { remindersQueryGroup } from 'src/features/reminders/queries';
import { transactionsQueryGroup } from 'src/features/transactions/queries';
import { transferencesQueryGroup } from 'src/features/transferences/queries';
import { Account } from 'src/generated';
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';

// Step 1: Create base CRUD operations
let accountsQueryGroupCRUD = createQueryGroupCRUD<Account['id']>('accounts');

// Step 2: Inject authentication context
accountsQueryGroupCRUD = inyectKeysToQueries(accountsQueryGroupCRUD, {
  auth: true,
});

// Step 3: Extend with custom operations
export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,

  // Override remove with cascading invalidations
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

  // Add custom query for associates
  associates: {
    queryKey: { entity: 'accounts', scope: 'associates', method: 'list' },
  },

  // Add custom mutation
  removeUser: {
    queryKey: { entity: 'accounts', scope: 'associates', method: 'removeUser' },
    invalidates: (id: Account['id']) => [
      { entity: 'accounts', id },
      { entity: 'accounts', scope: 'associates' },
      { entity: 'accounts', method: 'list' },
    ],
    type: 'mutation',
  },
};
```

## Static vs. Dynamic QueryKeys

The function handles both types:

### Static QueryKeys

```typescript
const group = {
  list: {
    queryKey: { entity: 'items', method: 'list' },
  },
};

const injected = inyectKeysToQueries(group, { auth: true });

console.log(injected.list.queryKey);
// { entity: 'items', method: 'list', auth: true }
```

### Dynamic QueryKeys (Functions)

```typescript
const group = {
  detail: {
    queryKey: (id: string) => ({ entity: 'items', method: 'detail', id }),
  },
};

const injected = inyectKeysToQueries(group, { auth: true });

console.log(injected.detail.queryKey('123'));
// { entity: 'items', method: 'detail', id: '123', auth: true }
```

## Advanced Patterns

### Conditional Injection

Apply different metadata based on context:

```typescript
const createContextualQueryGroup = <T>(entityName: string) => {
  let group = createQueryGroupCRUD<T>(entityName);

  const injected: Record<string, any> = { auth: true };

  // Add tenant ID in multi-tenant mode
  if (isMultiTenantMode()) {
    injected.tenantId = getCurrentTenantId();
  }

  // Add workspace in team context
  if (hasWorkspaceContext()) {
    injected.workspaceId = getCurrentWorkspaceId();
  }

  // Add feature flags
  if (hasFeatureFlags()) {
    injected.features = getActiveFeatures();
  }

  return inyectKeysToQueries(group, injected);
};
```

### Chaining Injections

Apply multiple levels of context:

```typescript
// First, inject auth
let queryGroup = createQueryGroupCRUD('items');
queryGroup = inyectKeysToQueries(queryGroup, { auth: true });

// Then, inject tenant context
queryGroup = inyectKeysToQueries(queryGroup, { tenantId: getCurrentTenantId() });

// Result: { entity: 'items', method: 'list', auth: true, tenantId: '42' }
```

### Helper Factory

Create reusable helpers:

```typescript
// src/queries/helpers.ts
export const createAuthQueryGroup = <T>(entityName: string) => {
  let group = createQueryGroupCRUD<T>(entityName);
  return inyectKeysToQueries(group, { auth: true });
};

export const createTenantQueryGroup = <T>(entityName: string) => {
  let group = createQueryGroupCRUD<T>(entityName);
  return inyectKeysToQueries(group, {
    auth: true,
    tenantId: getCurrentTenantId(),
  });
};

// Usage
export const accountsQueryGroup = createAuthQueryGroup<Account['id']>('accounts');
export const productsQueryGroup = createTenantQueryGroup<Product['id']>('products');
```

## TypeScript Considerations

### Preserving Types

The function preserves the input type:

```typescript
type MyQueryGroup = {
  list: QueryGroup<string>;
  detail: QueryGroupResolved<string>;
};

const original: MyQueryGroup = createQueryGroupCRUD('items');
const injected: MyQueryGroup = inyectKeysToQueries(original, { auth: true });
// Type is preserved
```

### Extending QueryKey Type

For better type safety, you can extend the QueryKey type:

```typescript
// Custom QueryKey type with auth
type AuthQueryKey<T> = QueryKey<T> & {
  auth: boolean;
};

// Usage (note: this is for documentation, actual injection is runtime)
const accountsQueryGroup = inyectKeysToQueries(
  createQueryGroupCRUD<Account['id']>('accounts'),
  { auth: true }
);
```

## Cache Isolation

Injected keys create separate cache entries:

```typescript
// Without injection
{ entity: 'posts', method: 'list' }
// Single cache entry shared by all users

// With user injection
{ entity: 'posts', method: 'list', userId: 'user-A' }
{ entity: 'posts', method: 'list', userId: 'user-B' }
// Separate cache entries per user
```

This is usually desired for:
- **Multi-user apps**: Different cache per user
- **Multi-tenant apps**: Different cache per tenant
- **Role-based access**: Different cache for admin vs. user

## Best Practices

### 1. Inject Early

Apply immediately after creating the query group:

```typescript
// GOOD
let group = createQueryGroupCRUD('items');
group = inyectKeysToQueries(group, { auth: true });

export const itemsQueryGroup = { ...group };
```

### 2. Use Consistent Property Names

```typescript
// GOOD - Consistent naming
inyectKeysToQueries(group, { auth: true });
inyectKeysToQueries(anotherGroup, { auth: true });

// AVOID - Inconsistent naming
inyectKeysToQueries(group, { authenticated: true });
inyectKeysToQueries(anotherGroup, { isAuth: true });
```

### 3. Only Inject Global Context

```typescript
// GOOD - Global user context
inyectKeysToQueries(group, {
  auth: true,
  userId: currentUserId,
});

// AVOID - Query-specific parameters
inyectKeysToQueries(group, {
  auth: true,
  page: 1, // Should be in query params
  filter: 'active', // Should be in query params
});
```

### 4. Document Injection Purpose

```typescript
// Add comment explaining why properties are injected
let accountsQueryGroup = createQueryGroupCRUD<Account['id']>('accounts');

// All account queries require authentication
accountsQueryGroup = inyectKeysToQueries(accountsQueryGroup, { auth: true });
```

## Performance Considerations

### Injection is Shallow

The function creates a shallow copy with injected properties:

```typescript
// Efficient - no deep cloning
inyectKeysToQueries(group, { auth: true });
```

### Apply Once

Inject during query group creation, not on every use:

```typescript
// GOOD - Inject once during initialization
let group = createQueryGroupCRUD('items');
group = inyectKeysToQueries(group, { auth: true });
export const itemsQueryGroup = group;

// AVOID - Don't inject on every hook call
export const useItems = () => {
  const group = inyectKeysToQueries(createQueryGroupCRUD('items'), { auth: true });
  // This creates a new group every render!
};
```

## See Also

- [Key Injection Pattern](../core-concepts/key-injection.md) - Detailed explanation and examples
- [createQueryGroupCRUD](./createQueryGroupCRUD.md) - Creating base query groups
- [Query Groups](../core-concepts/query-groups.md) - Understanding query group structure
- [Entity Mapping](../patterns/entity-mapping.md) - Using query keys for dynamic invalidation
