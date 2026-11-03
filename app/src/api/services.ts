import { z } from 'zod';
import { apiRequest } from './client';
import {
  authResponseSchema,
  areaListResponseSchema,
  equipmentResponseSchema,
  equipmentListResponseSchema,
  meResponseSchema,
  sessionListResponseSchema,
  type AppUser,
  type Equipment,
  type SessionSetInput,
} from './schemas';

const emptyResponseSchema = z.void();
const sessionBatchResponseSchema = z.object({
  data: z.array(z.object({ data: z.unknown(), created: z.boolean() })),
  created: z.number(),
  idempotent: z.number(),
});

export async function login(input: {
  identifier: string;
  password: string;
}): Promise<z.infer<typeof authResponseSchema>> {
  return apiRequest(
    '/auth/login',
    authResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
    false,
  );
}

export async function register(input: {
  name: string;
  email: string;
  cpf: string;
  password: string;
  gymId: string;
  consentTracking: boolean;
}): Promise<z.infer<typeof authResponseSchema>> {
  const cpf = input.cpf.replace(/\D/g, '');
  return apiRequest(
    '/auth/register',
    authResponseSchema,
    { method: 'POST', body: JSON.stringify({ ...input, cpf }) },
    false,
  );
}

export async function fetchAreas(): Promise<
  z.infer<typeof areaListResponseSchema>['data']
> {
  const response = await apiRequest('/areas', areaListResponseSchema);
  return response.data;
}

export async function fetchEquipments(areaId?: string): Promise<
  z.infer<typeof equipmentListResponseSchema>['data']
> {
  const query = areaId ? `?areaId=${encodeURIComponent(areaId)}` : '';
  const response = await apiRequest(
    `/equipment${query}`,
    equipmentListResponseSchema,
  );
  return response.data;
}

export async function fetchCurrentUser(): Promise<AppUser> {
  const response = await apiRequest('/auth/me', meResponseSchema);
  return response.user;
}

export async function updateTrackingConsent(
  consentTracking: boolean,
): Promise<AppUser> {
  const response = await apiRequest(
    '/auth/me/consent',
    meResponseSchema,
    { method: 'PATCH', body: JSON.stringify({ consentTracking }) },
  );
  return response.user;
}

export async function logout(refreshToken: string | null): Promise<void> {
  await apiRequest(
    '/auth/logout',
    emptyResponseSchema,
    { method: 'POST', body: JSON.stringify({ refreshToken }) },
  );
}

export async function fetchEquipmentByBeacon(input: {
  uuid: string;
  major: number;
  minor: number;
}): Promise<Equipment> {
  const query = new URLSearchParams({
    uuid: input.uuid,
    major: String(input.major),
    minor: String(input.minor),
  });
  const response = await apiRequest(
    `/equipment/beacon?${query.toString()}`,
    equipmentResponseSchema,
  );
  return response.data;
}

export async function fetchTrainingSessions(page = 1, limit = 50): Promise<
  z.infer<typeof sessionListResponseSchema>
> {
  return apiRequest(`/sessions?page=${page}&limit=${limit}`, sessionListResponseSchema);
}

export async function fetchAllTrainingSessions(): Promise<
  z.infer<typeof sessionListResponseSchema>['data']
> {
  const firstPage = await fetchTrainingSessions(1, 100);
  const sessions = [...firstPage.data];

  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const result = await fetchTrainingSessions(page, 100);
    sessions.push(...result.data);
  }

  return sessions;
}

export async function recordTrainingSession(input: {
  clientSessionId: string;
  equipmentId: string;
  areaId: string;
  startedAt: string;
  endedAt: string;
  sets: SessionSetInput[];
}): Promise<void> {
  await apiRequest(
    '/sessions/batch',
    sessionBatchResponseSchema,
    { method: 'POST', body: JSON.stringify({ sessions: [input] }) },
  );
}
