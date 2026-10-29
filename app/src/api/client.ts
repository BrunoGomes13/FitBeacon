import { z } from 'zod';
import { useAppStore } from '../state/store';

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ??
  'http://localhost:3000/api/v1';

const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().nullable().optional(),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken, setTokens, clearSession } = useAppStore.getState();

  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearSession();
    return false;
  }

  const body = await response.json();
  const tokens = z
    .object({
      accessToken: z.string(),
      refreshToken: z.string(),
    })
    .parse(body);
  setTokens(tokens);
  return true;
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const execute = async (token: string | null): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  };

  let token = authenticated ? useAppStore.getState().accessToken : null;
  let response = await execute(token);

  if (response.status === 401 && authenticated && (await refreshAccessToken())) {
    token = useAppStore.getState().accessToken;
    response = await execute(token);
  }

  if (!response.ok) {
    const errorBody = apiErrorSchema.safeParse(await response.json().catch(() => null));

    throw new ApiError(
      response.status,
      errorBody.success ? errorBody.data.code : 'API_ERROR',
      errorBody.success ? errorBody.data.message : 'Não foi possível concluir a solicitação.',
    );
  }

  if (response.status === 204) {
    return schema.parse(undefined);
  }

  return schema.parse(await response.json());
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}
