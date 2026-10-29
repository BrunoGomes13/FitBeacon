import { z } from 'zod';
import { apiRequest } from './client';
import {
  authResponseSchema,
  equipmentResponseSchema,
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
  email: string;
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
  password: string;
  gymId: string;
  consentTracking: boolean;
}): Promise<z.infer<typeof authResponseSchema>> {
  return apiRequest(
    '/auth/register',
    authResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
    false,
  );
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

export async function fetchTrainingSessions(page = 1): Promise<
  z.infer<typeof sessionListResponseSchema>
> {
  return apiRequest(`/sessions?page=${page}&limit=50`, sessionListResponseSchema);
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
