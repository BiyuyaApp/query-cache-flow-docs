---
sidebar_position: 1
title: KUBB Integration
description: Complete guide to integrating Query Cache Flow with KUBB code generation
---

# KUBB Integration

KUBB generates type-safe React Query hooks from your OpenAPI specification. Query Cache Flow wraps these generated hooks with proper cache key management.

## What is KUBB?

[KUBB](https://kubb.dev) is a code generator that reads your OpenAPI/Swagger specification and produces:

- TypeScript types for all API schemas
- React Query hooks for all API endpoints
- Fully typed request/response handling

## The Integration Flow

```
OpenAPI Spec → KUBB → Generated Hooks → Query Cache Flow Wrappers → Your Components
```

1. **OpenAPI Spec**: Your backend's API definition (`openapi.json`)
2. **KUBB**: Generates hooks like `useGetAccounts`, `useCreateAccount`
3. **Query Cache Flow**: Wraps with proper cache keys and invalidation
4. **Components**: Use the wrapped hooks with zero cache management

## KUBB Configuration

### Install Dependencies

```bash
npm install @kubb/core @kubb/plugin-oas @kubb/plugin-ts @kubb/plugin-react-query
```

### kubb.config.ts

```typescript
import { defineConfig } from '@kubb/core';
import { pluginOas } from '@kubb/plugin-oas';
import { pluginReactQuery } from '@kubb/plugin-react-query';
import { pluginTs } from '@kubb/plugin-ts';

export default defineConfig({
  input: {
    path: './openapi.json',
  },
  output: {
    path: './src/generated',
    clean: true,
    barrelType: 'all',
  },
  plugins: [
    // Parse OpenAPI spec
    pluginOas(),

    // Generate TypeScript types
    pluginTs(),

    // Generate React Query hooks
    pluginReactQuery({
      client: {
        // Point to your axios client
        importPath: '../../services/axios.ts',
        dataReturnType: 'data',
      },
      output: {
        path: './hooks',
        barrelType: 'all',
      },
      mutation: {
        // POST, PUT, DELETE, PATCH become mutations
        methods: ['post', 'put', 'delete', 'patch'],
      },
      query: {
        // GET becomes queries
        methods: ['get'],
        importPath: '@tanstack/react-query',
      },
      suspense: false,
    }),
  ],
});
```

### Generate Code

```bash
npx kubb generate
# Or add to package.json scripts:
# "generate": "kubb generate"
```

## Generated Output Structure

After running KUBB, your project has:

```
src/
  generated/
    index.ts           # Barrel export
    types/             # TypeScript interfaces
      Account.ts
      Transaction.ts
      ...
    hooks/
      index.ts
      useGetAccounts.ts
      useGetAccountById.ts
      useCreateAccount.ts
      useUpdateAccount.ts
      useDeleteAccount.ts
      ...
```

## Wrapping Generated Hooks

### Query Wrapper Pattern

```typescript
// src/features/accounts/queries/useAccounts.ts
import { useGetAccounts as generatedUseAccounts } from 'src/generated';
import { accountsQueryGroup } from './index';

export const useAccounts = () =>
  generatedUseAccounts({
    query: {
      queryKey: [accountsQueryGroup.list.queryKey],
    },
  });
```

### Detail Query with ID

```typescript
// src/features/accounts/queries/useAccount.ts
import { useGetAccountById as generatedUseAccount } from 'src/generated';
import { accountsQueryGroup } from './index';

export const useAccount = (accountId: string) =>
  generatedUseAccount(accountId, {
    query: {
      queryKey: [accountsQueryGroup.detail.queryKey(accountId)],
    },
  });
```

### Mutation Wrapper Pattern

```typescript
// src/features/accounts/queries/useAccountCreate.ts
import { useCreateAccount as generatedAccountCreate } from 'src/generated';
import { accountsQueryGroup } from './index';
import { invalidateQueriesForKeys } from 'src/queries';

interface UseAccountCreateProps {
  onSuccess?: (data: Account, variables: CreateAccountDto, context: unknown) => void;
  onError?: (error: Error, variables: CreateAccountDto, context: unknown) => void;
}

export const useAccountCreate = ({ onSuccess, onError, ...rest }: UseAccountCreateProps = {}) =>
  generatedAccountCreate({
    mutation: {
      mutationKey: [accountsQueryGroup.create.queryKey],
      onSuccess: (data, variables, context) => {
        // Apply optimistic update
        accountsQueryGroup.create.normalize?.(data);

        // Invalidate list queries
        invalidateQueriesForKeys([
          accountsQueryGroup.create.invalidates!,
        ]);

        // Call user's callback
        onSuccess?.(data, variables, context);
      },
      onError,
      ...rest,
    },
  });
```

### Update Mutation with ID

```typescript
// src/features/accounts/queries/useAccountUpdate.ts
import { useUpdateAccount as generatedAccountUpdate } from 'src/generated';
import { accountsQueryGroup } from './index';
import { invalidateQueriesForKeys } from 'src/queries';

interface UseAccountUpdateProps {
  accountId: string;
  onSuccess?: (data: Account, variables: UpdateAccountDto, context: unknown) => void;
}

export const useAccountUpdate = ({ accountId, onSuccess, ...rest }: UseAccountUpdateProps) =>
  generatedAccountUpdate(accountId, {
    mutation: {
      mutationKey: [accountsQueryGroup.update.queryKey(accountId)],
      onSuccess: (data, variables, context) => {
        accountsQueryGroup.update.normalize?.(data);
        invalidateQueriesForKeys(
          accountsQueryGroup.update.invalidates(accountId)
        );
        onSuccess?.(data, variables, context);
      },
      ...rest,
    },
  });
```

## Project Structure

Organize your features with Query Cache Flow:

```
src/
  features/
    accounts/
      queries/
        index.ts           # Query group definition
        useAccounts.ts     # List query wrapper
        useAccount.ts      # Detail query wrapper
        useAccountCreate.ts
        useAccountUpdate.ts
        useAccountDelete.ts
      components/
        AccountList.tsx
        AccountForm.tsx
      pages/
        AccountsPage.tsx
```

### Query Group Index

```typescript
// src/features/accounts/queries/index.ts
import { Account } from 'src/generated';
import { createQueryGroupCRUD, inyectKeysToQueries } from 'src/queries';

// Create base CRUD group
let accountsQueryGroupCRUD = createQueryGroupCRUD<Account['id']>('accounts');

// Add auth key to all queries
accountsQueryGroupCRUD = inyectKeysToQueries(accountsQueryGroupCRUD, {
  auth: true,
});

// Export with any customizations
export const accountsQueryGroup = {
  ...accountsQueryGroupCRUD,
  // Add custom queries if needed
};
```

## Axios Client for KUBB

KUBB needs a custom axios client:

```typescript
// src/services/axios.ts
import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

export type RequestConfig<TData = unknown> = {
  baseURL?: string;
  url?: string;
  method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE' | 'OPTIONS';
  params?: unknown;
  data?: TData | FormData;
  responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
  signal?: AbortSignal;
  headers?: AxiosRequestConfig['headers'];
};

export type ResponseConfig<TData = unknown> = {
  data: TData;
  status: number;
  statusText: string;
  headers?: AxiosResponse['headers'];
};

export type ResponseErrorConfig<TError = unknown> = AxiosError<TError>;

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Add auth interceptor
axiosInstance.interceptors.request.use((config) => {
  const token = getAuthToken(); // Your auth logic
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The client function KUBB will use
export const axiosClient = async <TData, TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>
): Promise<ResponseConfig<TData>> => {
  return axiosInstance.request<TData, ResponseConfig<TData>>(config);
};

export default axiosClient;
```

## Regenerating After API Changes

When your OpenAPI spec changes:

```bash
# 1. Update openapi.json from backend
cp ../backend/openapi.json ./openapi.json

# 2. Regenerate
npm run generate

# 3. Update any affected wrapper hooks
# (Usually no changes needed if only adding endpoints)
```

## TypeScript Integration

KUBB generates types you can use:

```typescript
import {
  Account,
  CreateAccountDto,
  UpdateAccountDto,
  AccountsQueryParams,
} from 'src/generated';

// Use in your query group
const accountsQueryGroup = createQueryGroupCRUD<Account['id']>('accounts');

// Use in wrapper hooks
export const useAccountCreate = (props: {
  onSuccess?: (data: Account) => void;
}) => { ... };
```

## Common Patterns

### Conditional Query Options

```typescript
export const useAccount = (accountId: string | undefined) =>
  generatedUseAccount(accountId!, {
    query: {
      queryKey: [accountsQueryGroup.detail.queryKey(accountId!)],
      enabled: !!accountId,  // Only run when ID exists
    },
  });
```

### With Query Parameters

```typescript
export const useTransactions = (params?: TransactionsQueryParams) =>
  generatedUseTransactions({
    query: {
      queryKey: [transactionsQueryGroup.list.queryKey(params)],
    },
    ...params,  // Pass filters to API
  });
```

### Custom Query Options

```typescript
export const useAccounts = (options?: Partial<UseQueryOptions>) =>
  generatedUseAccounts({
    query: {
      queryKey: [accountsQueryGroup.list.queryKey],
      staleTime: 5 * 60 * 1000,  // 5 minutes
      ...options,
    },
  });
```

## Best Practices

### 1. Never Use Generated Hooks Directly

```typescript
// Bad - no cache management
import { useGetAccounts } from 'src/generated';
const { data } = useGetAccounts();

// Good - proper cache keys
import { useAccounts } from 'src/features/accounts/queries';
const { data } = useAccounts();
```

### 2. Keep Wrappers Thin

Wrappers should only add cache keys and invalidation. Business logic belongs in components.

### 3. Use Generated Types

```typescript
import { Account, CreateAccountDto } from 'src/generated';
// Don't manually define API types
```

### 4. Regenerate Frequently

Run code generation as part of your build process or CI pipeline.

## Troubleshooting

### "Module not found: src/generated"

Run `npm run generate` to create the generated files.

### Type Mismatches After API Changes

Regenerate and check for breaking changes:

```bash
npm run generate
npm run typecheck
```

### Cache Not Invalidating

Ensure wrapper hooks call `invalidateQueriesForKeys` in `onSuccess`.

## Summary

KUBB + Query Cache Flow provides:

1. **Type safety** from OpenAPI to components
2. **Zero manual hook writing** for API calls
3. **Automatic cache management** via wrappers
4. **Consistent patterns** across all features

The two-layer approach (KUBB generates, Query Cache Flow wraps) keeps your code DRY while maintaining full cache control.
