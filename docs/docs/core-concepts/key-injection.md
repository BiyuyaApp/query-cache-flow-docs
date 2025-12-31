# Key Injection

Key injection is a powerful pattern that allows you to add metadata to all query keys within a query group. This is particularly useful for adding context like authentication status, user scope, or tenant information to every query in your application.

## The Problem

When working with cache keys, you often need to add contextual information that applies to all queries in a group. For example:

- **Authentication**: All queries for authenticated users should include `{ auth: true }`
- **Multi-tenancy**: All queries should include the current tenant ID
- **User scope**: Queries should differentiate between admin and regular users

Manually adding this to every query key is tedious and error-prone.

## The Solution: `inyectKeysToQueries`

The `inyectKeysToQueries` function recursively processes a query group and injects additional properties into all `queryKey` objects.

### Type Signature

```typescript
export const inyectKeysToQueries = <T extends Record<string, any>>(
  queries: T,
  extra: Record<string, any>,
): T
```

### How It Works

The function:

1. **Recursively traverses** the query group object
2. **Finds all `queryKey` properties** (both static objects and functions)
3. **Merges the extra properties** into each queryKey
4. **Preserves function behavior** for dynamic keys
5. **Returns a new object** with injected keys

## Basic Example

```typescript
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';
import { Account } from 'src/generated';

// Create a basic CRUD query group
let accountsQueryGroupCRUD = createQueryGroupCRUD<Account['id']>('accounts');

// Inject authentication flag into ALL query keys
accountsQueryGroupCRUD = inyectKeysToQueries(accountsQueryGroupCRUD, {
  auth: true,
});

// Now all query keys automatically include { auth: true }
console.log(accountsQueryGroupCRUD.list.queryKey);
// Output: { entity: 'accounts', method: 'list', auth: true }

console.log(accountsQueryGroupCRUD.detail.queryKey('123'));
// Output: { entity: 'accounts', method: 'detail', id: '123', auth: true }
```

## Real-World Example

Here's how accounts are configured in a production app:

```typescript
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';
import { Account } from 'src/generated';

// Step 1: Create base CRUD operations
let accountsQueryGroupCRUD = createQueryGroupCRUD<Account['id']>('accounts');

// Step 2: Inject auth flag into all keys
accountsQueryGroupCRUD = inyectKeysToQueries(accountsQueryGroupCRUD, {
  auth: true,
});

// Step 3: Extend with custom operations and cascading invalidations
export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,
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
  associates: {
    queryKey: { entity: 'accounts', scope: 'associates', method: 'list' },
  },
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

## Advanced Use Cases

### Multi-Tenant Applications

```typescript
const tenantId = getCurrentTenantId();

let productsQueryGroup = createQueryGroupCRUD<Product['id']>('products');

// All product queries now include the tenant context
productsQueryGroup = inyectKeysToQueries(productsQueryGroup, {
  tenantId,
  auth: true,
});

// Result: { entity: 'products', method: 'list', tenantId: '42', auth: true }
```

### User Scope Differentiation

```typescript
const userRole = getCurrentUserRole();

let reportsQueryGroup = createQueryGroupCRUD<Report['id']>('reports');

// Different cache keys for admin vs regular users
reportsQueryGroup = inyectKeysToQueries(reportsQueryGroup, {
  scope: userRole, // 'admin' or 'user'
  auth: true,
});

// Admin sees: { entity: 'reports', method: 'list', scope: 'admin', auth: true }
// User sees: { entity: 'reports', method: 'list', scope: 'user', auth: true }
```

### Feature Flags

```typescript
const featureFlags = getActiveFeatureFlags();

let analyticsQueryGroup = createQueryGroupCRUD('analytics');

analyticsQueryGroup = inyectKeysToQueries(analyticsQueryGroup, {
  features: featureFlags, // ['beta-dashboard', 'advanced-metrics']
  auth: true,
});
```

## Implementation Details

The function works recursively to handle nested structures:

```typescript
export const inyectKeysToQueries = <T extends Record<string, any>>(
  queries: T,
  extra: Record<string, any>,
): T => {
  const process = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(process);
    } else if (obj && typeof obj === 'object') {
      // If the object has a "queryKey" property, inject extra keys
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

## Best Practices

### 1. Apply Early

Inject keys immediately after creating the query group:

```typescript
// GOOD: Inject before extending
let queryGroup = createQueryGroupCRUD('users');
queryGroup = inyectKeysToQueries(queryGroup, { auth: true });

export const usersQueryGroup = {
  ...queryGroup,
  // custom operations
};
```

### 2. Use Consistent Metadata

Keep injected properties consistent across your application:

```typescript
// GOOD: Consistent auth pattern
inyectKeysToQueries(queryGroup, { auth: true });

// AVOID: Inconsistent naming
inyectKeysToQueries(queryGroup, { authenticated: true });
inyectKeysToQueries(anotherGroup, { isAuth: true });
```

### 3. Don't Over-Inject

Only inject truly global context:

```typescript
// GOOD: Global user context
inyectKeysToQueries(queryGroup, {
  auth: true,
  userId: currentUserId,
});

// AVOID: Query-specific parameters should go in the key itself
inyectKeysToQueries(queryGroup, {
  auth: true,
  page: 1, // This should be in individual query params
  filter: 'active', // This should be in individual query params
});
```

### 4. Consider Cache Isolation

Injected keys create separate cache entries:

```typescript
// These will be cached separately:
// User A: { entity: 'posts', method: 'list', userId: 'A' }
// User B: { entity: 'posts', method: 'list', userId: 'B' }

let postsGroup = createQueryGroupCRUD('posts');
postsGroup = inyectKeysToQueries(postsGroup, {
  userId: currentUserId,
});
```

This is usually desired behavior for multi-user apps, but be aware of the cache multiplication effect.

## Common Patterns

### Global Auth Injection Helper

Create a reusable helper for authenticated query groups:

```typescript
// src/queries/helpers.ts
export const createAuthQueryGroup = <T>(entityName: string) => {
  let group = createQueryGroupCRUD<T>(entityName);
  return inyectKeysToQueries(group, { auth: true });
};

// Usage
export const accountsQueryGroup = createAuthQueryGroup<Account['id']>('accounts');
export const transactionsQueryGroup = createAuthQueryGroup<Transaction['id']>('transactions');
```

### Conditional Injection

Apply different metadata based on context:

```typescript
const createScopedQueryGroup = <T>(entityName: string) => {
  let group = createQueryGroupCRUD<T>(entityName);

  const injectedKeys: Record<string, any> = { auth: true };

  if (isMultiTenantMode()) {
    injectedKeys.tenantId = getCurrentTenantId();
  }

  if (hasFeatureFlag('beta-caching')) {
    injectedKeys.cacheVersion = 'v2';
  }

  return inyectKeysToQueries(group, injectedKeys);
};
```

## Summary

Key injection with `inyectKeysToQueries`:

- **Reduces boilerplate** by adding metadata once instead of per-query
- **Ensures consistency** across all queries in a group
- **Supports multi-tenancy** and user scoping
- **Works with both static and dynamic** query keys
- **Enables cache isolation** based on context

Use it whenever you need to add global context to your cache keys.
