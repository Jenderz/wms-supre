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
  export:  () => {
    const token = TokenService.get();
    window.open(`${API_URL}/categories/export${token ? `?api_token=${token}` : ''}`, '_blank');
    // Alternativa si el backend no soporta api_token en query: usar fetch + blob.
    // Pero para simplificar, si el export asume auth, podrías necesitar pasar el token.
    // Dado que index.php usa AuthMiddleware::verify() que mira el header Authorization,
    // window.open no enviará el header. Usaremos fetch + blob.
  },
  exportCsv: async () => {
    const token = TokenService.get();
    const response = await fetch(`${API_URL}/categories/export`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) throw new Error('Error al exportar');
    return await response.blob();
  },
  importCsv: async (file: File) => {
    const token = TokenService.get();
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/categories/import`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Error al importar');
    }
    return await response.json();
  }
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
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ProductFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number | string;
}

export const ProductApi = {
  getAll:  ()                        => get<unknown[]>('/products'),
  getPaginated: (params: ProductFilterParams = {}) => {
    const q = new URLSearchParams();
    if (params.page !== undefined) q.append('page', String(params.page));
    if (params.limit !== undefined) q.append('limit', String(params.limit));
    if (params.search) q.append('search', params.search);
    if (params.categoryId !== undefined) q.append('categoryId', String(params.categoryId));
    return get<PaginatedResult<unknown>>(`/products?${q.toString()}`);
  },
  getOne:  (id: string | number)     => get<unknown>(`/products/${id}`),
  create:  (data: unknown)           => post<{ id: number }>('/products', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/products/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/products/${id}`),
  batch: (data: {
    action: 'delete' | 'setCategory' | 'setSubcategory' | 'setProvider' | 'addWarehouse';
    productIds: string[];
    value?: string | null;
  }) => post<{ message: string; affected: number }>('/products/batch', data),
};

// ===========================================================
// Warehouses
// ===========================================================
export const WarehouseApi = {
  getAll:  ()                        => get<unknown[]>('/warehouses'),
  create:  (data: unknown)           => post<{ id: number }>('/warehouses', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/warehouses/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/warehouses/${id}`),
};

// ===========================================================
// Space Types
// ===========================================================
export const SpaceTypeApi = {
  getAll:  ()                        => get<unknown[]>('/space-types'),
  create:  (data: unknown)           => post<{ id: number }>('/space-types', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/space-types/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/space-types/${id}`),
};

// ===========================================================
// Warehouse Spaces
// ===========================================================
export const WarehouseSpaceApi = {
  getAll:  (warehouseId?: string | number) =>
    get<unknown[]>(warehouseId ? `/warehouse-spaces?warehouseId=${warehouseId}` : '/warehouse-spaces'),
  create:  (data: unknown)           => post<{ id: number }>('/warehouse-spaces', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/warehouse-spaces/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/warehouse-spaces/${id}`),
};

// ===========================================================
// Space Groups
// ===========================================================
export const SpaceGroupApi = {
  getAll:  (warehouseId?: string | number) =>
    get<unknown[]>(warehouseId ? `/space-groups?warehouseId=${warehouseId}` : '/space-groups'),
  create:  (data: unknown)           => post<{ id: number }>('/space-groups', data),
  update:  (id: string | number, data: unknown) => put<unknown>(`/space-groups/${id}`, data),
  remove:  (id: string | number)     => del<void>(`/space-groups/${id}`),
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
export interface MovementFilterParams {
  page?: number;
  limit?: number;
  type?: string;
  warehouseId?: number | string;
  productId?: number | string;
  dateFrom?: string;
  dateTo?: string;
}

export const MovementApi = {
  getAll: () => get<unknown[]>('/movements'),
  getPaginated: (params: MovementFilterParams = {}) => {
    const q = new URLSearchParams();
    if (params.page !== undefined) q.append('page', String(params.page));
    if (params.limit !== undefined) q.append('limit', String(params.limit));
    if (params.type) q.append('type', params.type);
    if (params.warehouseId !== undefined) q.append('warehouseId', String(params.warehouseId));
    if (params.productId !== undefined) q.append('productId', String(params.productId));
    if (params.dateFrom) q.append('dateFrom', params.dateFrom);
    if (params.dateTo) q.append('dateTo', params.dateTo);
    return get<PaginatedResult<unknown>>(`/movements?${q.toString()}`);
  },
};

// ===========================================================
// Access Keys (Llaves)
// ===========================================================
export const LockApi = {
  getAll:  ()                                            => get<unknown[]>('/locks'),
  create:  (data: unknown)                               => post<{ id: number }>('/locks', data),
  update:  (id: string | number, data: unknown)          => put<unknown>(`/locks/${id}`, data),
  remove:  (id: string | number)                         => del<void>(`/locks/${id}`),
  verify:  (module: string, action: string, key: string) =>
    post<{ success: boolean; error?: string }>('/locks/verify', { module, action, key }),
};

// ===========================================================
// Dispatch Orders (Despachos)
// ===========================================================
export interface DispatchFilterParams {
  page?: number;
  limit?: number;
  warehouseId?: number | string;
  status?: string;
  search?: string;
}

export const DispatchApi = {
  getAll: (warehouseId?: number | string) => {
    const q = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    return get<unknown[]>(`/dispatches${q}`);
  },
  getPaginated: (params: DispatchFilterParams = {}) => {
    const q = new URLSearchParams();
    if (params.page !== undefined) q.append('page', String(params.page));
    if (params.limit !== undefined) q.append('limit', String(params.limit));
    if (params.warehouseId !== undefined) q.append('warehouseId', String(params.warehouseId));
    if (params.status) q.append('status', params.status);
    if (params.search) q.append('search', params.search);
    return get<PaginatedResult<unknown>>(`/dispatches?${q.toString()}`);
  },
  getOne:  (id: string | number)                 => get<unknown>(`/dispatches/${id}`),
  create:  (data: unknown)                       => post<{ id: number }>('/dispatches', data),
  update:  (id: string | number, data: unknown)  => put<unknown>(`/dispatches/${id}`, data),
  remove:  (id: string | number)                 => del<void>(`/dispatches/${id}`),
  updateStatus: (id: string | number, status: string) =>
    patch<unknown>(`/dispatches/${id}/status`, { status }),
};

// ===========================================================
// Token helpers (usados por AuthContext)
// ===========================================================
export const TokenService = {
  save:    (token: string) => localStorage.setItem(TOKEN_KEY, token),
  get:     ()              => localStorage.getItem(TOKEN_KEY),
  remove:  ()              => localStorage.removeItem(TOKEN_KEY),
};

