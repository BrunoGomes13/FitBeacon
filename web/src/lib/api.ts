import { clearTokens, getTokens, setTokens } from './session';
import type { AuthTokens, ReportFilters } from './types';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = RequestInit & {
  authenticated?: boolean;
  responseType?: 'json' | 'blob';
};

type ApiErrorResponse = {
  code?: string;
  message?: string;
};

let refreshRequest: Promise<AuthTokens | null> | null = null;

async function refreshTokens(): Promise<AuthTokens | null> {
  const current = getTokens();
  if (!current) return null;

  if (!refreshRequest) {
    refreshRequest = fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) {
          clearTokens();
          return null;
        }
        const body = (await response.json()) as AuthTokens;
        setTokens(body);
        return body;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

export async function refreshSession(): Promise<AuthTokens> {
  const refreshed = await refreshTokens();
  if (!refreshed) {
    throw new ApiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
  }
  return refreshed;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = true, responseType = 'json', ...init } = options;
  const execute = (accessToken?: string): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(`${apiUrl}${path}`, { ...init, headers });
  };

  let token = authenticated ? getTokens()?.accessToken : undefined;
  let response = await execute(token);
  if (response.status === 401 && authenticated && getTokens()) {
    const refreshed = await refreshSession();
    token = refreshed.accessToken;
    response = await execute(token);
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    throw new ApiError(response.status, error.code ?? 'API_ERROR', error.message ?? 'Não foi possível concluir a solicitação.');
  }
  if (responseType === 'blob') return (await response.blob()) as T;
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function downloadReportCsv(filters: ReportFilters): Promise<Blob> {
  const params = new URLSearchParams({
    from: new Date(`${filters.from}T00:00:00.000Z`).toISOString(),
    to: new Date(`${filters.to}T23:59:59.999Z`).toISOString(),
    groupBy: filters.equipmentId ? 'equipment' : filters.areaId ? 'area' : 'equipment',
  });
  if (filters.areaId) params.set('areaId', filters.areaId);
  if (filters.equipmentId) params.set('equipmentId', filters.equipmentId);
  return apiFetch<Blob>(`/reports/export.csv?${params}`, { responseType: 'blob' });
}

export async function logoutCurrentSession(): Promise<void> {
  const tokens = getTokens();
  if (!tokens) return;
  const response = await fetch(`${apiUrl}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    throw new ApiError(response.status, error.code ?? 'LOGOUT_FAILED', error.message ?? 'Não foi possível encerrar a sessão no servidor.');
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
