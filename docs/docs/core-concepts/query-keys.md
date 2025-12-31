# Query Keys

Query keys are the foundation of Query Cache Flow. They provide a consistent, structured approach to identifying cached data in TanStack Query.

## The QueryKey Type

In Query Cache Flow, all cache keys follow a single structured format:

```typescript
export type QueryKey<T> = {
  entity: string;
  method?: 'list' | 'detail' | 'create' | 'update' | 'remove' | string;
  id?: T;
};
```

### Fields Explained

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `entity` | Yes | The resource or entity type | `'accounts'`, `'transactions'` |
| `method` | No | The operation being performed | `'list'`, `'detail'`, `'create'` |
| `id` | No | Unique identifier for a specific resource | `'123'`, `42`, `uuid` |

## Why This Structure?

### 1. Consistency

All cache keys follow the same pattern across your entire application:

```typescript
// List all accounts
{ entity: 'accounts', method: 'list' }

// Get a specific account
{ entity: 'accounts', method: 'detail', id: '123' }

// Create a new account
{ entity: 'accounts', method: 'create' }
```

### 2. Predictability

Knowing the structure makes invalidation straightforward:

```typescript
// Invalidate all account queries
{ entity: 'accounts' }

// Invalidate a specific account
{ entity: 'accounts', id: '123' }

// Invalidate the list query
{ entity: 'accounts', method: 'list' }
```

### 3. Type Safety

Generic type parameter `T` ensures ID types are type-checked:

```typescript
// String IDs
const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');
accountsQueryGroup.detail.queryKey('123'); // OK
accountsQueryGroup.detail.queryKey(123);   // Error

// Numeric IDs
const postsQueryGroup = createQueryGroupCRUD<number>('posts');
postsQueryGroup.detail.queryKey(123);    // OK
postsQueryGroup.detail.queryKey('123');  // Error
```

## Query Key Examples

### Basic Queries

```typescript
// List all transactions
{
  entity: 'transactions',
  method: 'list'
}

// Get transaction detail
{
  entity: 'transactions',
  method: 'detail',
  id: 'txn_123'
}

// All currencies (no method needed)
{
  entity: 'currencies'
}
```

### With Additional Context

You can extend query keys with additional fields for filtering or context:

```typescript
// List with auth context
{
  entity: 'accounts',
  method: 'list',
  auth: true
}

// List with filters
{
  entity: 'transactions',
  method: 'list',
  filters: { status: 'pending' }
}

// Detail with tenant context
{
  entity: 'users',
  method: 'detail',
  id: '456',
  tenantId: 'org_789'
}
```

## How TanStack Query Uses Keys

TanStack Query wraps your structured key in an array:

```typescript
// Your Query Cache Flow key
const queryKey = { entity: 'accounts', method: 'list' };

// How it's used in TanStack Query
useQuery({
  queryKey: [queryKey],
  queryFn: fetchAccounts,
});

// TanStack Query stores it as: [{ entity: 'accounts', method: 'list' }]
```

## Key Hierarchy

Query Cache Flow keys form a natural hierarchy for invalidation:

```
{ entity: 'accounts' }                           // All account queries
  └─ { entity: 'accounts', method: 'list' }     // List query
  └─ { entity: 'accounts', id: '123' }          // Specific account
      └─ { entity: 'accounts', method: 'detail', id: '123' }  // Detail query
```

Invalidating `{ entity: 'accounts' }` invalidates **all** account-related queries.

Invalidating `{ entity: 'accounts', id: '123' }` invalidates **only** queries for that specific account.

## Static vs Dynamic Keys

### Static Keys

Used for queries that don't depend on parameters:

```typescript
const list = {
  queryKey: { entity: 'accounts', method: 'list' },
};

// Usage
useQuery({ queryKey: [list.queryKey], ... });
```

### Dynamic Keys

Used for queries that require parameters (like an ID):

```typescript
const detail = {
  queryKey: (id: string) => ({ entity: 'accounts', method: 'detail', id }),
};

// Usage
useQuery({ queryKey: [detail.queryKey('123')], ... });
```

## Best Practices

### 1. Always Use Objects

```typescript
// Good - structured object
{ entity: 'accounts', method: 'list' }

// Bad - string-based key
['accounts', 'list']
```

### 2. Be Consistent with Entity Names

```typescript
// Good - consistent naming
{ entity: 'accounts', method: 'list' }
{ entity: 'accounts', method: 'detail', id: '123' }

// Bad - inconsistent naming
{ entity: 'account', method: 'list' }      // singular
{ entity: 'accounts', method: 'detail' }   // plural
```

### 3. Use Standard Methods

Stick to the standard CRUD methods when possible:

- `list` - Get all records
- `detail` - Get a single record
- `create` - Create a new record
- `update` - Update an existing record
- `remove` - Delete a record

### 4. Extend Keys, Don't Replace Them

```typescript
// Good - extending with additional context
{
  entity: 'accounts',
  method: 'list',
  auth: true,
  filters: { active: true }
}

// Bad - replacing the structure
{
  type: 'GET_ACCOUNTS',
  params: { auth: true }
}
```

## Working with Query Keys

### Reading Keys

```typescript
const accountsQueryGroup = createQueryGroupCRUD('accounts');

// Static key
console.log(accountsQueryGroup.list.queryKey);
// Output: { entity: 'accounts', method: 'list' }

// Dynamic key
console.log(accountsQueryGroup.detail.queryKey('123'));
// Output: { entity: 'accounts', method: 'detail', id: '123' }
```

### Invalidating by Key

```typescript
import { invalidateQueriesForKeys } from 'src/queries';

// Invalidate specific keys
invalidateQueriesForKeys([
  { entity: 'accounts', method: 'list' },
  { entity: 'accounts', id: '123' }
]);
```

### Canceling by Key

```typescript
import { cancelQueriesForKeys } from 'src/queries';

// Cancel in-flight queries
cancelQueriesForKeys([
  { entity: 'accounts', method: 'list' }
]);
```

## Next Steps

- [Query Groups](query-groups) - Learn how keys are organized into groups
- [CRUD Factory](crud-factory) - Generate complete key sets automatically
- [Key Injection](key-injection) - Add context to all keys in a group
