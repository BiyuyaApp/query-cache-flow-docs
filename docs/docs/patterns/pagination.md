---
sidebar_position: 4
title: Pagination
description: Handle paginated queries with query parameters in CACHE-FLOW cache keys
---

# Pagination

CACHE-FLOW supports paginated queries by including query parameters in cache keys. This ensures each page of data has its own cache entry.

## The Problem

Without proper key management, pagination causes cache conflicts:

```typescript
// Bad: Same key for all pages
const { data: page1 } = useQuery({ queryKey: ['transactions'] });
const { data: page2 } = useQuery({ queryKey: ['transactions'] }); // Overwrites page1!
```

## The Solution: Query Parameters in Keys

Include pagination parameters in your query keys:

```typescript
// Good: Unique key per page
const { data: page1 } = useQuery({
  queryKey: [{ entity: 'transactions', method: 'list', query: { page: 1 } }]
});
const { data: page2 } = useQuery({
  queryKey: [{ entity: 'transactions', method: 'list', query: { page: 2 } }]
});
```

## Extending QueryGroup for Pagination

Override the `list` operation to accept query parameters:

```typescript
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';
import { RemindersQueryParams } from 'src/generated';

let remindersQueryGroupCRUD = createQueryGroupCRUD<string>('reminders');
remindersQueryGroupCRUD = inyectKeysToQueries(remindersQueryGroupCRUD, {
  auth: true,
});

export const remindersQueryGroup = {
  ...remindersQueryGroupCRUD,

  // Override list to accept query params
  list: {
    queryKey: (query?: RemindersQueryParams) => ({
      ...remindersQueryGroupCRUD.list.queryKey,
      query,  // Adds: { page, limit, sort, filter, etc. }
    }),
  },
};
```

## Query Parameter Types

Define your query parameters based on your API:

```typescript
interface RemindersQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'dueDate' | 'title';
  sortOrder?: 'asc' | 'desc';
  status?: 'pending' | 'completed' | 'overdue';
  accountId?: string;
}
```

## Using Paginated Queries

### Basic Pagination Hook

```typescript
export const useReminders = (params?: RemindersQueryParams) =>
  generatedReminders({
    query: {
      queryKey: [remindersQueryGroup.list.queryKey(params)],
    },
    // Pass params to the API call
    ...params,
  });
```

### In Components

```typescript
function RemindersList() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RemindersQueryParams>({
    limit: 20,
    status: 'pending',
  });

  const { data, isLoading } = useReminders({
    ...filters,
    page,
  });

  return (
    <>
      <ReminderFilters value={filters} onChange={setFilters} />
      <ReminderList items={data?.items} />
      <Pagination
        page={page}
        totalPages={data?.totalPages}
        onPageChange={setPage}
      />
    </>
  );
}
```

## Invalidation Strategies

### Invalidate All Pages

Use the base `list` key without parameters to invalidate all paginated queries:

```typescript
// Invalidates ALL reminder pages
queryClient.invalidateQueries({
  queryKey: [{ entity: 'reminders', method: 'list' }],
});

// Or use the all key for even broader invalidation
queryClient.invalidateQueries({
  queryKey: [remindersQueryGroup.all.queryKey],
});
```

### Invalidate Specific Page

```typescript
// Invalidates only page 1
queryClient.invalidateQueries({
  queryKey: [remindersQueryGroup.list.queryKey({ page: 1 })],
});
```

### Mutation Invalidation

When creating/updating/deleting, invalidate the list (all pages):

```typescript
export const useReminderCreate = ({ onSuccess, ...rest }) =>
  generatedReminderCreate({
    mutation: {
      onSuccess: (data, variables, context) => {
        // Invalidate all pages - new item could appear on any page
        invalidateQueriesForKeys([
          { entity: 'reminders', method: 'list' },
        ]);
        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Cursor-Based Pagination

For cursor/infinite scroll pagination:

```typescript
interface MovementsQueryParams {
  cursor?: string;
  limit?: number;
  accountId?: string;
}

export const movementsQueryGroup = {
  all: {
    queryKey: { entity: 'movements' },
  },
  list: {
    queryKey: (query?: MovementsQueryParams) => ({
      entity: 'movements',
      method: 'list',
      query,
    }),
  },
};
```

### With Infinite Query

```typescript
export const useMovementsInfinite = (params: Omit<MovementsQueryParams, 'cursor'>) =>
  useInfiniteQuery({
    queryKey: [movementsQueryGroup.list.queryKey(params)],
    queryFn: ({ pageParam }) =>
      fetchMovements({ ...params, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
```

## Complex Filtering

For APIs with many filter options:

```typescript
interface TransactionsQueryParams {
  // Pagination
  page?: number;
  limit?: number;

  // Sorting
  sortBy?: 'date' | 'amount' | 'category';
  sortOrder?: 'asc' | 'desc';

  // Filters
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  type?: 'income' | 'expense';
  search?: string;
}

export const transactionsQueryGroup = {
  ...transactionsQueryGroupCRUD,

  list: {
    queryKey: (query?: TransactionsQueryParams) => ({
      ...transactionsQueryGroupCRUD.list.queryKey,
      query,
    }),
  },

  // Helper for filtering without pagination
  filtered: {
    queryKey: (filters: Omit<TransactionsQueryParams, 'page' | 'limit'>) => ({
      entity: 'transactions',
      method: 'list',
      query: filters,
    }),
  },
};
```

## Prefetching Pages

Improve UX by prefetching adjacent pages:

```typescript
function TransactionsList() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Prefetch next page
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: [transactionsQueryGroup.list.queryKey({ page: page + 1 })],
      queryFn: () => fetchTransactions({ page: page + 1 }),
    });
  }, [page]);

  // ...
}
```

## Best Practices

### 1. Always Include Query Params in Keys

```typescript
// Good
queryKey: [queryGroup.list.queryKey({ page, filters })]

// Bad - will cause cache conflicts
queryKey: [queryGroup.list.queryKey]
```

### 2. Use Partial Matching for Invalidation

```typescript
// Invalidates all variations of the list query
queryClient.invalidateQueries({
  queryKey: [{ entity: 'transactions', method: 'list' }],
  exact: false,  // Default - matches any query starting with this key
});
```

### 3. Keep Query Params Serializable

```typescript
// Good - serializable
{ page: 1, startDate: '2024-01-01' }

// Bad - non-serializable values
{ page: 1, dateRange: new DateRange() }
```

### 4. Normalize Filter Values

Ensure consistent cache keys by normalizing undefined/empty values:

```typescript
list: {
  queryKey: (query?: QueryParams) => ({
    ...baseCRUD.list.queryKey,
    query: query ? normalizeParams(query) : undefined,
  }),
}

function normalizeParams(params: QueryParams): QueryParams {
  return Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
  );
}
```

## Summary

| Pattern | Use Case |
|---------|----------|
| Page-based | Traditional pagination with page numbers |
| Cursor-based | Infinite scroll, real-time feeds |
| Filter-based | Search, filtering, sorting |
| Combined | Complex data grids with all features |

CACHE-FLOW's query parameter support makes all pagination patterns work seamlessly with automatic cache management.
