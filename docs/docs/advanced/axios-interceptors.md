---
sidebar_position: 2
title: Axios Interceptors
description: Configure axios interceptors for authentication and error handling with Query Cache Flow
---

# Axios Interceptors

Axios interceptors handle cross-cutting concerns like authentication, error handling, and request/response transformation. This guide shows how to integrate them with Query Cache Flow.

## Basic Setup

### Create the Axios Instance

```typescript
// src/services/axios.ts
import axios from 'axios';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

// Types for KUBB compatibility
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

// Create instance with base config
export const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## Request Interceptors

### Authentication

Add the auth token to every request:

```typescript
import { useSession } from 'src/features/auth/stores/session';

axiosInstance.interceptors.request.use(
  (config) => {
    const token = useSession.getState().accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);
```

### Language/Locale

Include the user's language preference:

```typescript
import i18next from 'i18next';

axiosInstance.interceptors.request.use(
  (config) => {
    config.headers['Accept-Language'] = i18next.language;
    return config;
  },
  (error) => Promise.reject(error)
);
```

### Combined Request Interceptor

```typescript
axiosInstance.interceptors.request.use(
  (config) => {
    // Auth
    const token = useSession.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Locale
    config.headers['Accept-Language'] = i18next.language;

    // Request ID for tracing
    config.headers['X-Request-ID'] = crypto.randomUUID();

    return config;
  },
  (error) => Promise.reject(error)
);
```

## Response Interceptors

### Error Handling

Handle common HTTP errors globally:

```typescript
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Don't redirect on login page
      if (error.config?.url !== '/auth/login') {
        console.log('Session expired - clearing auth');
        useSession.getState().clear();
        // Optional: redirect to login
        window.location.href = '/login';
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.log('Access denied');
      // Optional: redirect to unauthorized page
    }

    // Handle 500+ Server Errors
    if (error.response?.status && error.response.status >= 500) {
      console.error('Server error:', error.response.data);
      // Optional: show global error toast
    }

    throw error;
  }
);
```

### Token Refresh

Automatically refresh expired tokens:

```typescript
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers!.Authorization = `Bearer ${token}`;
            resolve(axiosInstance(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useSession.getState().refreshToken;
        const response = await axios.post('/auth/refresh', { refreshToken });
        const { accessToken } = response.data;

        useSession.getState().setTokens(accessToken, refreshToken);
        onTokenRefreshed(accessToken);

        originalRequest.headers!.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        useSession.getState().clear();
        window.location.href = '/login';
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }

    throw error;
  }
);
```

## Integration with Query Cache Flow

### Cache Invalidation on Auth Changes

When authentication changes, invalidate user-specific caches:

```typescript
// In your auth store or logout function
function logout() {
  // Clear tokens
  useSession.getState().clear();

  // Clear ALL cached data (user-specific)
  queryClient.clear();

  // Redirect
  window.location.href = '/login';
}
```

### Server-Driven Invalidation

Handle cache invalidation hints from the server:

```typescript
axiosInstance.interceptors.response.use(
  (response) => {
    // Check for cache invalidation header
    const invalidateEntities = response.headers['x-invalidate-entities'];

    if (invalidateEntities) {
      const entities = invalidateEntities.split(',');
      invalidateAffectedEntities(entities);
    }

    return response;
  },
  (error) => {
    throw error;
  }
);
```

### Rate Limiting Awareness

Handle 429 Too Many Requests:

```typescript
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];

      if (retryAfter) {
        const delay = parseInt(retryAfter, 10) * 1000;

        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, delay));
        return axiosInstance(error.config!);
      }
    }

    throw error;
  }
);
```

## The Client Function

Export the client function for KUBB:

```typescript
export const axiosClient = async <TData, TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>
): Promise<ResponseConfig<TData>> => {
  return axiosInstance
    .request<TData, ResponseConfig<TData>>(config)
    .catch((error: AxiosError<TError>) => {
      throw error;
    });
};

// Expose config methods
axiosClient.getConfig = () => axiosInstance.defaults;
axiosClient.setConfig = (config: Partial<AxiosRequestConfig>) => {
  Object.assign(axiosInstance.defaults, config);
};

export default axiosClient;
```

## Complete Example

```typescript
// src/services/axios.ts
import axios from 'axios';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import i18next from 'i18next';
import { useSession } from 'src/features/auth/stores/session';
import { invalidateAffectedEntities } from 'src/queries/entityMap';

// Types
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

// Create instance
export const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Add auth token
    const token = useSession.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add locale
    config.headers['Accept-Language'] = i18next.language;

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    // Handle server cache invalidation hints
    const invalidateEntities = response.headers['x-invalidate-entities'];
    if (invalidateEntities) {
      invalidateAffectedEntities(invalidateEntities.split(','));
    }

    return response;
  },
  (error: AxiosError) => {
    // Handle 401/403
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (error.config?.url !== '/auth/login') {
        useSession.getState().clear();
      }
    }

    throw error;
  }
);

// Export client for KUBB
export const axiosClient = async <TData, TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>
): Promise<ResponseConfig<TData>> => {
  return axiosInstance.request<TData, ResponseConfig<TData>>(config);
};

export default axiosClient;
```

## Best Practices

### 1. Keep Interceptors Focused

Each interceptor should do one thing. Combine concerns thoughtfully.

### 2. Handle Errors Gracefully

Don't swallow errors - always `throw` after handling.

### 3. Avoid Circular Dependencies

If interceptors need Query Cache Flow functions, use dynamic imports or dependency injection.

### 4. Test Interceptors

```typescript
describe('axios interceptors', () => {
  it('adds auth header when token exists', async () => {
    useSession.getState().setTokens('test-token', 'refresh');

    const request = await axiosInstance.request({ url: '/test' });

    expect(request.config.headers.Authorization).toBe('Bearer test-token');
  });
});
```

## Summary

Axios interceptors complement Query Cache Flow by handling:

- **Authentication** - Token injection and refresh
- **Error handling** - Global error responses
- **Localization** - Language headers
- **Cache coordination** - Server-driven invalidation

Together, they create a robust data layer that handles auth, caching, and errors transparently.
