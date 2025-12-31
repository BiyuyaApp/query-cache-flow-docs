# Installation

Query Cache Flow is a pattern, not a package. Instead of installing via npm, you copy the implementation into your project and customize it to your needs.

## Prerequisites

Before implementing Query Cache Flow, ensure your project has:

- **TanStack Query** v5.x (`@tanstack/react-query`)
- **TypeScript** (recommended, but not required)
- **React** 18+

```bash
npm install @tanstack/react-query
# or
yarn add @tanstack/react-query
# or
pnpm add @tanstack/react-query
```

## Step 1: Create the Queries Directory

Create a `src/queries` directory in your project:

```bash
mkdir -p src/queries
```

## Step 2: Set Up the Query Client

Create `src/queries/client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default queryClient;
```

## Step 3: Copy the Query Cache Flow Implementation

Create `src/queries/index.ts` with the complete Query Cache Flow implementation:

```typescript
import { InvalidateQueryFilters } from '@tanstack/react-query';
import queryClient from 'src/queries/client';

// Helper function to resolve query keys
const resolveKey = <T>(
  key: QueryKey<T> | ((...args: T[]) => QueryKey<T>),
  ...args: T[]
): QueryKey<T> => {
  return typeof key === 'function' ? key(...args) : key;
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

export type QueryKey<T> = {
  entity: string;
  method?: 'list' | 'detail' | 'create' | 'update' | 'remove' | string;
  id?: T;
};

export interface QueryGroupCRUD<T> {
  all: QueryGroup<T>;
  list: QueryGroup<T>;
  detail: QueryGroupResolved<T>;
  create: QueryGroup<T>;
  update: QueryGroupMutationResolved<T>;
  remove: QueryGroupMutationResolved<T>;
}

export const createQueryGroupCRUD = <T = string>(
  entityName: string,
): QueryGroupCRUD<T> => {
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
      queryClient.setQueryData(
        [resolveKey(detail.queryKey, data.id)],
        undefined,
      );
    },
  };

  return { all, list, detail, create, update, remove };
};

export const invalidateQueriesForKeys = (
  keys: Array<QueryKey<string>>,
  invalidateOptions?: InvalidateQueryFilters,
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
  extra: Record<string, any>,
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

## Step 4: Wrap Your App with QueryClientProvider

In your `App.tsx` or `main.tsx`:

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './queries/client';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app components */}
    </QueryClientProvider>
  );
}
```

## Verification

To verify the installation, create a simple test query group:

```typescript
// src/queries/test.ts
import { createQueryGroupCRUD } from './index';

const testQueryGroup = createQueryGroupCRUD('test');

console.log(testQueryGroup.list.queryKey);
// Output: { entity: 'test', method: 'list' }
```

If you see the correct output, Query Cache Flow is ready to use!

## Next Steps

- [Quick Start Guide](quick-start) - Create your first query group
- [Project Structure](project-structure) - Organize your queries
- [Core Concepts](../core-concepts/query-keys) - Understand the architecture
