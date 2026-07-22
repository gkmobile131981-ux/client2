const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('gk_refresh_token');
  if (!refreshToken) {
    throw new ApiError('No refresh token available', 401);
  }

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    throw new ApiError('Refresh token expired', 401);
  }

  const data = await response.json();
  if (!data?.accessToken) {
    throw new ApiError('Invalid refresh response', 401);
  }

  localStorage.setItem('gk_access_token', data.accessToken);
  if (data.refreshToken) {
    localStorage.setItem('gk_refresh_token', data.refreshToken);
  }

  return data.accessToken;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry: boolean = false
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  // Auto-inject token from local storage
  const token = localStorage.getItem('gk_access_token');
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...options,
    headers
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    // 401 Automatic Silent Token Refresh Interceptor
    if (
      response.status === 401 &&
      !isRetry &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          const retryHeaders = new Headers(options.headers || {});
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          return request<T>(endpoint, { ...options, headers: retryHeaders }, true);
        });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        processQueue(null, newToken);

        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        return request<T>(endpoint, { ...options, headers: retryHeaders }, true);
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr, null);

        // Clear all auth state and redirect to login if session cannot be recovered
        localStorage.removeItem('gk_access_token');
        localStorage.removeItem('gk_refresh_token');
        localStorage.removeItem('gk_cached_user');
        localStorage.removeItem('gk_cached_shop');
        localStorage.removeItem('gk_cached_role');

        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }

        throw new ApiError('Session expired. Please log in again.', 401);
      }
    }

    let errorMessage = 'An error occurred while processing your request';
    let details = null;
    
    try {
      const errorData = await response.json();
      if (errorData) {
        if (typeof errorData.error === 'string' && errorData.error.trim() !== '' && errorData.error !== '{}') {
          errorMessage = errorData.error;
        } else if (typeof errorData.message === 'string' && errorData.message.trim() !== '' && errorData.message !== '{}') {
          errorMessage = errorData.message;
        }
        details = errorData.details || null;
      }
    } catch {
      // Response wasn't JSON
    }
    
    throw new ApiError(errorMessage, response.status, details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
    
  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),
    
  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),
    
  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' })
};
