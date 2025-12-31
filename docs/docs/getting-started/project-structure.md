# Project Structure

This guide shows you how to organize CACHE-FLOW in your React application for maximum maintainability and scalability.

## Recommended Structure

```
src/
├── queries/
│   ├── client.ts           # QueryClient configuration
│   └── index.ts            # CACHE-FLOW implementation
├── features/
│   ├── accounts/
│   │   ├── queries/
│   │   │   ├── index.ts    # accountsQueryGroup definition
│   │   │   └── hooks.ts    # Wrapped query/mutation hooks
│   │   ├── components/
│   │   │   └── AccountsList.tsx
│   │   └── api/
│   │       └── accounts.ts  # API client functions
│   ├── transactions/
│   │   ├── queries/
│   │   │   ├── index.ts    # transactionsQueryGroup
│   │   │   └── hooks.ts
│   │   └── ...
│   └── ...
├── generated/              # KUBB-generated code (optional)
│   ├── hooks/
│   └── types/
└── App.tsx
```

## Core Infrastructure

### 1. Query Client (`src/queries/client.ts`)

```typescript
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default queryClient;
```

### 2. CACHE-FLOW Implementation (`src/queries/index.ts`)

This file contains the complete CACHE-FLOW implementation (see [Installation](installation) for the full code).

## Feature-Based Organization

### Query Group Definition

Each feature should have a `queries/index.ts` file that defines its query groups:

```typescript
// src/features/accounts/queries/index.ts
import { createQueryGroupCRUD } from 'src/queries';

export const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');
```

For entities that don't need full CRUD:

```typescript
// src/features/currencies/queries/index.ts
export const currenciesQueryGroup = {
  list: {
    queryKey: { entity: 'currencies', method: 'list' },
  },
};
```

### Wrapper Hooks

Create wrapper hooks in `queries/hooks.ts`:

```typescript
// src/features/accounts/queries/hooks.ts
import { useGetAccounts as generatedUseAccounts } from 'src/generated/hooks';
import { accountsQueryGroup } from './index';
import { invalidateQueriesForKeys } from 'src/queries';

// Query hooks
export const useAccounts = () =>
  generatedUseAccounts({
    query: { queryKey: [accountsQueryGroup.list.queryKey] },
  });

export const useAccount = (id: string) =>
  generatedUseAccount(id, {
    query: { queryKey: [accountsQueryGroup.detail.queryKey(id)] },
  });

// Mutation hooks
export const useCreateAccount = () =>
  useMutation({
    mutationFn: createAccount,
    onSuccess: (data) => {
      invalidateQueriesForKeys([accountsQueryGroup.create.invalidates]);
      accountsQueryGroup.create.normalize?.(data);
    },
  });
```

## API Layer

Keep your API client functions separate from queries:

```typescript
// src/features/accounts/api/accounts.ts
import axios from 'src/services/axios';

export interface Account {
  id: string;
  name: string;
  balance: number;
}

export const fetchAccounts = async (): Promise<Account[]> => {
  const { data } = await axios.get('/accounts');
  return data;
};

export const fetchAccount = async (id: string): Promise<Account> => {
  const { data } = await axios.get(`/accounts/${id}`);
  return data;
};

export const createAccount = async (account: Omit<Account, 'id'>): Promise<Account> => {
  const { data } = await axios.post('/accounts', account);
  return data;
};
```

## KUBB Integration (Optional)

If you're using KUBB for code generation:

```
src/
├── generated/              # KUBB output
│   ├── hooks/             # Auto-generated hooks
│   ├── types/             # TypeScript types
│   └── index.ts
├── kubb.config.ts         # KUBB configuration
└── openapi.json           # OpenAPI specification
```

Your wrapper hooks import from `generated/hooks` and add CACHE-FLOW cache keys:

```typescript
import { useGetAccounts } from 'src/generated/hooks';
import { accountsQueryGroup } from './index';

export const useAccounts = () =>
  useGetAccounts({
    query: { queryKey: [accountsQueryGroup.list.queryKey] },
  });
```

## Shared Query Groups

For globally-used entities, create a shared queries directory:

```
src/
├── shared/
│   └── queries/
│       ├── auth.ts        # Authentication queries
│       └── user.ts        # User profile queries
```

```typescript
// src/shared/queries/auth.ts
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';

// Add auth: true to all query keys
export const authQueryGroup = inyectKeysToQueries(
  createQueryGroupCRUD('session'),
  { auth: true }
);
```

## Best Practices

### 1. One Query Group Per Entity

```typescript
// Good
const accountsQueryGroup = createQueryGroupCRUD('accounts');
const transactionsQueryGroup = createQueryGroupCRUD('transactions');

// Avoid - Don't mix entities
const financeQueryGroup = { accounts: {}, transactions: {} };
```

### 2. Collocate Queries with Features

Keep query definitions close to the components that use them:

```
features/accounts/
├── queries/           # Query definitions
├── components/        # Components using the queries
└── api/              # API client functions
```

### 3. Use Consistent Naming

```typescript
// Query groups
export const accountsQueryGroup = ...
export const transactionsQueryGroup = ...

// Hooks
export const useAccounts = ...
export const useCreateAccount = ...
```

### 4. Separate Generated from Custom Code

```
src/
├── generated/        # KUBB output (git-ignored, regenerated)
├── features/         # Your custom code
└── queries/          # CACHE-FLOW infrastructure
```

## Example: Complete Feature Structure

```typescript
// src/features/accounts/queries/index.ts
export const accountsQueryGroup = createQueryGroupCRUD<string>('accounts');

// src/features/accounts/queries/hooks.ts
export const useAccounts = () => ...
export const useCreateAccount = () => ...

// src/features/accounts/api/accounts.ts
export const fetchAccounts = async () => ...
export const createAccount = async (data) => ...

// src/features/accounts/components/AccountsList.tsx
import { useAccounts } from '../queries/hooks';

export function AccountsList() {
  const { data: accounts } = useAccounts();
  // ...
}
```

## Next Steps

- [Query Keys](../core-concepts/query-keys) - Understand cache key structure
- [CRUD Factory](../core-concepts/crud-factory) - Learn about createQueryGroupCRUD
- [Wrapper Hooks](../patterns/wrapper-hooks) - Master hook wrapping patterns
