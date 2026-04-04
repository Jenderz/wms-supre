/**
 * ApiService.ts
 * Cliente HTTP centralizado para la API PHP de Supre WMS.
 * Maneja autenticación JWT automática en cada petición.
 */

const API_URL = (import.meta.env.VITE_API_URL as string) || '/api';
const TOKEN_KEY = 'supre_wms_token';

// ===========================================================
// HTTP Client base
// ===========================================================
const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    // Token expirado o inválido: cerrar sesión
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('supre_wms_user');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { error?: string }).error || `Error ${response.status}`);
  }

  // 204 No Content no tiene body
  if (response.status === 204) return undefined as T;

  const data = await response.json();
  // La API devuelve { data: ... } o { token: ..., user: ... }
  return ('data' in data ? data.data : data) as T;
};

const get  = <T>(path: string)                => request<T>('GET',    path);
const post = <T>(path: string, body: unknown) => request<T>('POST',   path, body);
const put  = <T>(path: string, body: unknown) => request<T>('PUT',    path, body);
const del  = <T>(path: string)                => request<T>('DELETE', path);
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body);

// ===========================================================
// Auth
// ===========================================================
export const AuthApi = {
  login: (username: string, password: string) =>
    post<{ token: string; user: object }>('/auth/login', { username, password }),
  verifyPassword: (password: string) =>
    post<{ success: boolean; message: string }>('/auth/verify-password', { password }),
};

// ===========================================================
// Users
// ===========================================================
export const UserApi = {
  getAll:  ()                        => get<unknown[]>('/users'),
  create:  (data: unknown)           => post<{ id: number }>('/users', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/users/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/users/${id}`),
};

export const CategoryApi = {
  getAll:  ()                        => get<unknown[]>('/categories'),
  create:  (data: unknown)           => post<{ id: number }>('/categories', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/categories/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/categories/${id}`),
};

// ===========================================================
// Providers
// ===========================================================
export const ProviderApi = {
  getAll:  ()                        => get<unknown[]>('/providers'),
  create:  (data: unknown)           => post<{ id: number }>('/providers', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/providers/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/providers/${id}`),
};

// ===========================================================
// Products
// ===========================================================
export const ProductApi = {
  getAll:  ()                        => get<unknown[]>('/products'),
  getOne:  (id: string | number)     => get<unknown>(`/products/${id}`),
  create:  (data: unknown)           => post<{ id: number }>('/products', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/products/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/products/${id}`),
};

// ===========================================================
// Stores
// ===========================================================
export const StoreApi = {
  getAll:  ()                        => get<unknown[]>('/stores'),
  create:  (data: unknown)           => post<{ id: number }>('/stores', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/stores/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/stores/${id}`),
};

// ===========================================================
// Locations
// ===========================================================
export const LocationApi = {
  getAll:  (storeId?: string | number) =>
    get<unknown[]>(storeId ? `/locations?storeId=${storeId}` : '/locations'),
  create:  (data: unknown)           => post<{ id: number }>('/locations', data),
  remove:  (id: string | number)     => del<void>(`/locations/${id}`),
};

// ===========================================================
// Stock
// ===========================================================
export const StockApi = {
  getAll:  ()             => get<unknown[]>('/stock'),
  upsert:  (data: unknown) => post<unknown>('/stock', data),
  move:    (data: unknown) => post<unknown>('/stock/move', data),
};

// ===========================================================
// Picking Lots
// ===========================================================
export const PickingLotApi = {
  getAll:  ()                          => get<unknown[]>('/picking-lots'),
  getOne:  (id: string | number)       => get<unknown>(`/picking-lots/${id}`),
  create:  (data: unknown)             => post<{ id: number }>('/picking-lots', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/picking-lots/${id}`, data),
  conform: (id: string | number)       => patch<unknown>(`/picking-lots/${id}/conform`),
  remove:  (id: string | number)       => del<void>(`/picking-lots/${id}`),
};

// ===========================================================
// Disincorporations
// ===========================================================
export const DisincorporationApi = {
  getAll:  ()                    => get<unknown[]>('/disincorporations'),
  getOne:  (id: string | number) => get<unknown>(`/disincorporations/${id}`),
  create:  (data: unknown)       => post<{ id: number }>('/disincorporations', data),
  approve: (id: string | number) => patch<unknown>(`/disincorporations/${id}/approve`),
  reject:  (id: string | number) => patch<unknown>(`/disincorporations/${id}/reject`),
};

// ===========================================================
// Stock Movements
// ===========================================================
export const MovementApi = {
  getAll: () => get<unknown[]>('/movements'),
};

// ===========================================================
// Token helpers (usados por AuthContext)
// ===========================================================
export const TokenService = {
  save:    (token: string) => localStorage.setItem(TOKEN_KEY, token),
  get:     ()              => localStorage.getItem(TOKEN_KEY),
  remove:  ()              => localStorage.removeItem(TOKEN_KEY),
};
